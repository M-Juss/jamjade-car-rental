"""Offline sliding-window alert replay on verified processing runs."""

import argparse
from collections import Counter, defaultdict
import json
import pickle
import sys

import numpy as np
from threadpoolctl import threadpool_limits

from compare_yaw_phases import TEMPORAL_COLUMNS, temporal_values, yaw_phases
from evaluate_yaw_forest import load_candidate, provenance
from train_pilot_v2 import CLASSES, require

HARSH = [label for label in CLASSES if label.startswith("harsh_")]
MIN_VOTE = 0.65
MERGE_GAP_MS = 600
MIN_IOU = 0.20
CORNER_HOLD_MS = 1200
SWERVE_REUSED_WINDOW_SHARE = 0.5
MAX_PHASE_GAP_MS = 300
BRAKING_VERTICAL_PEAK = 2.0
BRAKING_PITCH_RATE_PEAK = 0.8
SESSION10_NORMAL_CODES = {"S10-MD-R258", "S10-MD-R262", "S10-MD-R263", "S10-MD-R264"}


def alerts_for(model, windows):
    if not windows:
        return []
    matrix = [w["features"] + list(temporal_values([[0] * 6 + [yaw] for yaw in w["yaw"]]))
              for w in windows]
    probabilities = model.predict_proba(matrix)
    alerts = []
    active = {}
    for window, scores, features in zip(windows, probabilities, matrix, strict=True):
        index = int(np.argmax(scores))
        label, vote = model.classes_[index], float(scores[index])
        if label not in HARSH or vote < MIN_VOTE:
            continue
        end = window["end_ms"]
        previous = active.get(label)
        if previous is None or end - previous["last_ms"] > MERGE_GAP_MS:
            previous = {"target": label, "emitted_ms": end, "last_ms": end, "vote": vote,
                        "start_ms": window["start_ms"], "end_ms": end,
                        "yaw_phase_count": features[-len(TEMPORAL_COLUMNS)]}
            if label == "harsh_braking":
                previous["braking_evidence"] = window["braking_evidence"]
            active[label] = previous
            alerts.append(previous)
        else:
            previous["last_ms"] = end
    return alerts


def overlap(first, second):
    return max(0, min(first["end_ms"], second["end_ms"]) - max(first["start_ms"], second["start_ms"]))


def iou(first, second):
    intersection = overlap(first, second)
    union = max(first["end_ms"], second["end_ms"]) - min(first["start_ms"], second["start_ms"])
    return intersection / union


def audit_swerve_corners(record, alerts, audit):
    swerves = [label for label in record["labels"] if label["target"] == "harsh_swerve"]
    if not swerves:
        return
    audit["recordings"] += 1
    corners = [alert for alert in alerts if alert["target"] == "harsh_cornering"]
    predicted_swerves = [alert for alert in alerts if alert["target"] == "harsh_swerve"]
    if corners:
        audit["recordings_with_corner_alerts"] += 1
    for corner in corners:
        audit["corner_alerts"] += 1
        label = max(swerves, key=lambda swerve: overlap(corner, swerve))
        if overlap(corner, label) == 0:
            audit["outside_swerve_label"] += 1
            continue
        audit["overlaps_swerve_label"] += 1
        audit[f"corner_windows_with_{corner['yaw_phase_count']}_yaw_phases"] += 1
        if iou(corner, label) < MIN_IOU:
            audit["overlap_below_baseline_iou"] += 1
        overlapping = [swerve for swerve in predicted_swerves if overlap(corner, swerve) > 0]
        if not overlapping:
            audit["no_overlapping_swerve_alert"] += 1
            continue
        delay = min(swerve["emitted_ms"] for swerve in overlapping) - corner["emitted_ms"]
        if delay <= 0:
            audit["swerve_alert_already_available"] += 1
        else:
            audit["swerve_alert_arrived_later"] += 1
        for horizon in (600, 1200, 1800):
            if delay <= horizon:
                audit[f"overlapping_swerve_available_within_{horizon}_ms"] += 1


def hold_corner_alerts(alerts, processing_end_ms):
    """A corner may be released only after the deadline, using predictions available by then."""
    swerves = [alert for alert in alerts if alert["target"] == "harsh_swerve"]
    released = []
    decisions = Counter()
    for alert in alerts:
        if alert["target"] != "harsh_cornering":
            released.append(alert)
            continue
        deadline = alert["emitted_ms"] + CORNER_HOLD_MS
        if any(swerve["emitted_ms"] <= min(deadline, processing_end_ms)
               and overlap(alert, swerve) > 0 for swerve in swerves):
            decisions["folded_into_swerve"] += 1
        elif deadline > processing_end_ms:
            decisions["pending_at_recording_end"] += 1
        else:
            released.append({**alert, "emitted_ms": deadline})
            decisions["released"] += 1
    return released, decisions


def deduplicate_swerve_alerts(alerts):
    """Suppress repeat alerts when the later window substantially covers prior evidence."""
    emitted_swerves = []
    released = []
    suppressed = []
    for alert in sorted(alerts, key=lambda item: item["emitted_ms"]):
        if alert["target"] == "harsh_swerve":
            if any(overlap(prior, alert) >= SWERVE_REUSED_WINDOW_SHARE * (prior["end_ms"] - prior["start_ms"])
                   for prior in emitted_swerves):
                suppressed.append(alert)
                continue
            emitted_swerves.append(alert)
        released.append(alert)
    return released, suppressed


def review_braking_alerts(alerts):
    """Group the same sampled slowdown and retain ambiguous evidence for review."""
    seen_peaks = set()
    confirmed, uncertain, repeated = [], [], []
    for alert in sorted(alerts, key=lambda item: item["emitted_ms"]):
        if alert["target"] != "harsh_braking":
            confirmed.append(alert)
            continue
        evidence = alert["braking_evidence"]
        peak = evidence["peak_ms"]
        if peak in seen_peaks:
            repeated.append(alert)
            continue
        seen_peaks.add(peak)
        if (evidence["vertical_peak"] >= BRAKING_VERTICAL_PEAK
                and evidence["pitch_rate_peak"] >= BRAKING_PITCH_RATE_PEAK):
            uncertain.append(alert)
        else:
            confirmed.append(alert)
    return confirmed, uncertain, repeated


def separate_close_swerves(alerts, windows):
    """Preview a second event from six alternating phases in a trailing window."""
    swerves = [alert for alert in alerts if alert["target"] == "harsh_swerve"]
    if not swerves:
        return []
    additions = []
    used_seeds = set()
    for window in windows:
        if len(window["yaw"]) != 280:
            continue
        phases = yaw_phases([[0] * 6 + [yaw] for yaw in window["yaw"]])
        if len(phases) != 6:
            continue
        start = window["start_ms"]
        if any((following[1] - preceding[2]) * 20 > MAX_PHASE_GAP_MS
               for preceding, following in zip(phases, phases[1:])):
            continue
        first = {"start_ms": start + 20 * phases[0][1], "end_ms": start + 20 * phases[2][2]}
        second = {"start_ms": start + 20 * phases[3][1], "end_ms": start + 20 * phases[5][2]}
        if window["end_ms"] - second["end_ms"] > 200:
            continue
        candidates = [alert for alert in swerves if alert["emitted_ms"] <= first["end_ms"]
                      and overlap(first, alert) > 0]
        if len(candidates) != 1:
            continue
        seed = candidates[0]["emitted_ms"]
        if seed in used_seeds or any(
            alert["emitted_ms"] <= window["end_ms"] and overlap(second, alert) > 0
            for alert in [*swerves, *additions]
        ):
            continue
        used_seeds.add(seed)
        additions.append({**second, "target": "harsh_swerve", "emitted_ms": window["end_ms"],
                          "last_ms": window["end_ms"], "yaw_phase_count": 3,
                          "source": "close_swerve_phase_split"})
    return additions


def score(record, alerts, counts, delays, unmatched, by_protocol):
    labels = record["labels"]
    truth = [label for label in labels if label["target"] in HARSH]
    matched = set()
    for label in truth:
        counts[label["target"]]["actual"] += 1
    for alert in sorted(alerts, key=lambda item: item["emitted_ms"]):
        target = alert["target"]
        counts[target]["alerts"] += 1
        # Score the interval available at the first alert, before later windows can refine it.
        options = [(iou(alert, label), index) for index, label in enumerate(truth)
                   if label["target"] == target and label["start_ms"] < alert["emitted_ms"]]
        eligible = [(value, index) for value, index in options if value >= MIN_IOU]
        available = [(value, index) for value, index in eligible if index not in matched]
        if available:
            _, index = max(available)
            matched.add(index)
            counts[target]["matched"] += 1
            delays[target].append(alert["emitted_ms"] - truth[index]["start_ms"])
        else:
            if eligible:
                reason = "duplicate"
            elif any(iou(alert, label) >= MIN_IOU for label in truth):
                reason = "overlaps_harsh_label"
            elif sum(overlap(alert, label) for label in labels if label["target"] not in HARSH) >= (
                alert["end_ms"] - alert["start_ms"]
            ) / 2:
                reason = "mostly_labeled_nonharsh"
            else:
                reason = "unconfirmed"
            unmatched[reason] += 1
            by_protocol[record["protocol"]][reason] += 1


def replay(stream, expected_codes=None, expected_targets=()):
    _, blob = load_candidate(provenance())
    model = pickle.loads(blob)
    counts = defaultdict(Counter)
    delays = defaultdict(list)
    unmatched = Counter()
    by_protocol = defaultdict(Counter)
    coverage = Counter()
    swerve_corner_audit = Counter()
    held_counts = defaultdict(Counter)
    held_delays = defaultdict(list)
    held_unmatched = Counter()
    held_by_protocol = defaultdict(Counter)
    hold_decisions = Counter()
    dedup_counts = defaultdict(Counter)
    dedup_delays = defaultdict(list)
    dedup_unmatched = Counter()
    dedup_by_protocol = defaultdict(Counter)
    dedup_suppressed = 0
    split_alerts = {}
    braking_review_counts = defaultdict(Counter)
    braking_review_delays = defaultdict(list)
    braking_review_unmatched = Counter()
    braking_review_by_protocol = defaultdict(Counter)
    braking_uncertain = Counter()
    braking_repeated = Counter()
    recording_results = {}
    with threadpool_limits(limits=1):
        for line in stream:
            record = json.loads(line)
            coverage["recordings"] += 1
            coverage["window_count"] += len(record["windows"])
            coverage["processed_ms"] += record["processing_ms"]
            coverage["valid_ms"] += record["valid_ms"]
            coverage["original_ms"] += record["original_ms"]
            coverage["near_full_recordings"] += int(record["starts_at_zero"]
                                                   and record["original_ms"] - record["processing_ms"] <= 20)
            alerts = alerts_for(model, record["windows"])
            score(record, alerts, counts, delays, unmatched, by_protocol)
            audit_swerve_corners(record, alerts, swerve_corner_audit)
            held_alerts, decisions = hold_corner_alerts(alerts, record["processing_end_ms"])
            hold_decisions.update(decisions)
            score(record, held_alerts, held_counts, held_delays, held_unmatched, held_by_protocol)
            dedup_alerts, suppressed = deduplicate_swerve_alerts(held_alerts)
            dedup_suppressed += len(suppressed)
            score(record, dedup_alerts, dedup_counts, dedup_delays, dedup_unmatched, dedup_by_protocol)
            additions = separate_close_swerves(dedup_alerts, record["windows"])
            if additions:
                split_alerts[record["code"]] = additions
            confirmed, uncertain, repeated = review_braking_alerts([*dedup_alerts, *additions])
            if uncertain:
                braking_uncertain[record["code"]] += len(uncertain)
            if repeated:
                braking_repeated[record["code"]] += len(repeated)
            score(record, confirmed, braking_review_counts, braking_review_delays,
                  braking_review_unmatched, braking_review_by_protocol)
            if expected_codes is not None:
                code = record["code"]
                require(code in expected_codes and code not in recording_results
                        and tuple(label["target"] for label in record["labels"]) == expected_targets,
                        "The Session 10 replay inventory differs.")
                recording_results[code] = {
                    "window_count": len(record["windows"]),
                    "immediate": alerts,
                    "corner_hold": held_alerts,
                    "corner_hold_with_swerve_dedup": dedup_alerts,
                    "suppressed_swerves": suppressed,
                    "close_swerve_preview": sorted([*dedup_alerts, *additions], key=lambda alert: alert["emitted_ms"]),
                    "braking_review": {"confirmed": [a for a in confirmed if a["target"] == "harsh_braking"],
                                       "uncertain": uncertain, "repeated": repeated},
                }
    if expected_codes is not None:
        require(recording_results.keys() == expected_codes
                and coverage["near_full_recordings"] == len(expected_codes),
                "The Session 10 full-recording replay inventory differs.")
    else:
        require(coverage["recordings"] == 144, "Development replay inventory differs.")
    return {
        "coverage": coverage, "counts": counts, "unmatched": unmatched,
        "unmatched_by_protocol": by_protocol,
        "swerve_corner_audit": swerve_corner_audit,
        "corner_hold": {
            "duration_ms": CORNER_HOLD_MS, "decisions": hold_decisions,
            "counts": held_counts, "unmatched": held_unmatched,
            "corner_delay_ms": {
                "median": float(np.median(held_delays["harsh_cornering"])),
                "max": max(held_delays["harsh_cornering"]),
            } if held_delays["harsh_cornering"] else None,
        },
        "corner_hold_with_swerve_dedup": {
            "minimum_reused_window_share": SWERVE_REUSED_WINDOW_SHARE,
            "suppressed": dedup_suppressed,
            "counts": dedup_counts,
            "unmatched": dedup_unmatched,
        },
        "delay_ms": {label: {"median": float(np.median(values)), "max": max(values)}
                     for label, values in delays.items()},
        "close_swerve_additions": split_alerts,
        "braking_review": {"confirmed_counts": braking_review_counts["harsh_braking"],
                           "uncertain_by_recording": braking_uncertain,
                           "repeated_by_recording": braking_repeated},
        **({"recording_results": recording_results} if expected_codes is not None else {}),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--session10-normal", action="store_true")
    group.add_argument("--session10-swerve", action="store_true")
    group.add_argument("--session10-close", action="store_true")
    group.add_argument("--session10-double-preview", action="store_true")
    group.add_argument("--session10-double-check", action="store_true")
    args = parser.parse_args()
    if args.session10_normal:
        result = replay(sys.stdin, SESSION10_NORMAL_CODES, ("normal_motion", "normal_motion"))
    elif args.session10_swerve:
        result = replay(sys.stdin, {"S10-HSWL-R266", "S10-HSWR-R272"}, ("harsh_swerve",))
    elif args.session10_close:
        result = replay(sys.stdin, {"S10-MD-R273", "S10-MD-R280"}, ("harsh_cornering", "harsh_swerve"))
    elif args.session10_double_preview:
        result = replay(sys.stdin, {"S10-MD-R286", "S10-MD-R287"})
    elif args.session10_double_check:
        result = replay(sys.stdin, {"S10-MD-R289"})
    else:
        result = replay(sys.stdin)
    print(json.dumps(result, allow_nan=False))
