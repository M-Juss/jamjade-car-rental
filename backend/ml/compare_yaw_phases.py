"""Compare pilot statistics and temporal yaw features on development data."""

from collections import Counter
from itertools import groupby
import json
from pathlib import Path
import subprocess
import warnings

import numpy as np
from sklearn.base import clone
from sklearn.exceptions import ConvergenceWarning
from threadpoolctl import threadpool_limits

from train_pilot_v2 import COLUMNS, environment, folds, metrics, models, require

SNAPSHOT = "pilot-split-v3"
TEMPORAL_COLUMNS = ["yaw_phase_count", "yaw_pair_smaller_area", "yaw_pair_area_ratio",
                    "yaw_pair_shorter_span", "yaw_pair_gap"]


def yaw_phases(samples):
    yaw = [sample[6] for sample in samples]
    peak = max(map(abs, yaw))
    if peak == 0:
        return []
    threshold = 0.25 * peak

    def sign(reading):
        value = reading[1]
        return 1 if value >= threshold else -1 if value <= -threshold else 0

    phases = []
    for direction, run in groupby(enumerate(yaw), key=sign):
        points = list(run)
        if direction == 0 or len(points) < 6:
            continue
        start, end = points[0][0], points[-1][0] + 1
        angle = sum(abs(value) for _, value in points) * 0.02
        if phases and phases[-1][0] == direction:
            _, previous_start, _, previous_angle = phases[-1]
            phases[-1] = (direction, previous_start, end, previous_angle + angle)
        else:
            phases.append((direction, start, end, angle))
    return phases


def yaw_pair_features(phases):
    if len(phases) < 2:
        return (0.0, 0.0, 0.0, 0.0)
    _, first_start, first_end, first_angle = phases[0]
    _, second_start, second_end, second_angle = phases[1]
    return (
        min(first_angle, second_angle),
        min(first_angle, second_angle) / max(first_angle, second_angle),
        min(first_end - first_start, second_end - second_start) * 0.02,
        (second_start - first_end) * 0.02,
    )


def read_rows(*arguments):
    result = subprocess.run(
        ["php", "artisan", *arguments], cwd=Path(__file__).resolve().parents[1],
        stdout=subprocess.PIPE, check=True, text=True,
    )
    return [json.loads(line) for line in result.stdout.splitlines()]


def development_rows():
    feature_rows = read_rows("rc-research:extract-features", SNAPSHOT, "--stream")
    intervals = {
        row["interval_id"]: row
        for row in read_rows("rc-research:export-pilot", SNAPSHOT, "--stream=development")
        if row["role"] == "supervised_target"
    }
    require(len(feature_rows) == len(intervals) == len({r["interval_id"] for r in feature_rows}),
            "The development inventories differ.")
    for row in feature_rows:
        interval = intervals[row["interval_id"]]
        require(all(row[key] == interval[key] for key in ("target", "recording_id", "session_id")),
                "The development interval identities differ.")
    return feature_rows, intervals


def temporal_values(samples):
    phases = yaw_phases(samples)
    return (len(phases), *yaw_pair_features(phases))


def compare():
    environment()
    feature_rows, intervals = development_rows()
    values = [temporal_values(intervals[row["interval_id"]]["samples"]) for row in feature_rows]
    phases = [value[0] for value in values]
    pairs = [value[1:] for value in values]

    base = np.asarray([[r["features"][name] for name in COLUMNS] for r in feature_rows], dtype=np.float64)
    augmented = np.column_stack((base, phases))
    temporal = np.column_stack((augmented, pairs))
    targets = np.asarray([r["target"] for r in feature_rows])
    groups = np.asarray([r["session_id"] for r in feature_rows])
    splits = folds(base, targets, groups)
    comparisons = {}
    with threadpool_limits(limits=1), warnings.catch_warnings():
        warnings.simplefilter("error", ConvergenceWarning)
        for name, estimator in models().items():
            if name == "majority_baseline":
                continue
            comparisons[name] = {}
            for representation, matrix in (
                ("statistics", base),
                ("statistics_and_yaw_phases", augmented),
                ("statistics_and_yaw_pair", temporal),
            ):
                predictions = np.empty(len(targets), dtype=object)
                for train, held in splits:
                    fitted = clone(estimator).fit(matrix[train], targets[train])
                    predictions[held] = fitted.predict(matrix[held])
                comparisons[name][representation] = metrics(targets, predictions)
    return {
        "snapshot": SNAPSHOT, "intervals": len(targets), "session_folds": len(splits),
        "yaw_phase_counts": {target: dict(Counter(p for p, t in zip(phases, targets) if t == target))
                             for target in sorted(set(targets))},
        "two_phase_medians": {
            target: np.median([pair for pair, phase, label in zip(pairs, phases, targets)
                               if phase == 2 and label == target], axis=0).tolist()
            for target in sorted({label for phase, label in zip(phases, targets) if phase == 2})
        },
        "comparisons": comparisons,
    }


if __name__ == "__main__":
    print(json.dumps(compare(), allow_nan=False))
