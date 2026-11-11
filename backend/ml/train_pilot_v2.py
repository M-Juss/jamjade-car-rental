"""Local development-session comparison. JSON in/out; no plaintext data files."""

import base64
from collections import Counter
import hashlib
from importlib.metadata import version
import json
import math
from pathlib import Path
import pickle
import platform
import sys
import warnings

import numpy as np
from sklearn.base import clone
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.exceptions import ConvergenceWarning
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support
from sklearn.model_selection import LeaveOneGroupOut
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from threadpoolctl import threadpool_limits

VERSION = "rc-pilot-development-models-v2"
CLASSES = ["normal_motion", "harsh_acceleration", "harsh_braking", "harsh_cornering",
           "lane_change", "normal_swerve", "harsh_swerve"]
CHANNELS = ["acceleration_forward", "acceleration_right", "acceleration_up", "rotation_forward", "rotation_right", "rotation_up"]
COLUMNS = [f"{channel}_{stat}" for channel in CHANNELS for stat in ["mean", "std", "min", "max", "rms"]]
SEED = 42


def require(condition, message):
    if not condition:
        raise ValueError(message)


def environment():
    packages = {}
    for line in Path(__file__).with_name("requirements.txt").read_text().splitlines():
        name, expected = line.split("==")
        packages[name] = version(name)
        require(packages[name] == expected, "The pinned Python environment differs.")
    return {"python": platform.python_version(), "packages": packages}


def models():
    return {
        "majority_baseline": DummyClassifier(strategy="most_frequent"),
        "balanced_logistic": make_pipeline(
            StandardScaler(),
            LogisticRegression(C=1.0, solver="lbfgs", max_iter=2000, class_weight="balanced", random_state=SEED),
        ),
        "balanced_random_forest": RandomForestClassifier(
            n_estimators=300, max_depth=6, min_samples_leaf=2, max_features="sqrt",
            class_weight="balanced_subsample", random_state=SEED, n_jobs=1,
        ),
    }


def counts(values):
    return {label: int(Counter(values)[label]) for label in CLASSES}


def metrics(actual, predicted):
    precision, recall, f1, support = precision_recall_fscore_support(
        actual, predicted, labels=CLASSES, zero_division=0,
    )
    return {
        "accuracy": float(accuracy_score(actual, predicted)),
        "macro_f1_fixed_seven_classes": float(np.mean(f1)),
        "confusion_matrix_actual_rows_predicted_columns": confusion_matrix(actual, predicted, labels=CLASSES).tolist(),
        "per_class": {label: {"precision": float(precision[i]), "recall": float(recall[i]),
                              "f1": float(f1[i]), "support": int(support[i])} for i, label in enumerate(CLASSES)},
    }


def dataset(payload):
    require(payload["schema"] == VERSION and payload["features"]["schema"] == "rc-interval-statistics-v1", "Unsupported training contract.")
    feature_document = payload["features"]
    require(feature_document["source"]["partition"] == "development", "Training accepts development evidence only.")
    require(feature_document["definition"]["feature_columns"] == COLUMNS, "Feature order differs.")
    records = payload["recordings"]
    require(records and len({r["recording_id"] for r in records}) == len(records), "Recording identities are missing or duplicated.")
    require(all(r["partition"] == "development" for r in records), "Reserved evidence cannot enter training.")
    by_record = {row["recording_id"]: row for row in records}
    require(set(by_record) == {row["recording_id"] for row in feature_document["source"]["files"]}, "Source recording inventory differs.")
    rows = feature_document["examples"]
    require(0 < len(rows) <= 100000 and len({r["interval_id"] for r in rows}) == len(rows), "Example identities are missing or duplicated.")
    matrix, targets, groups = [], [], []
    for row in rows:
        record = by_record.get(row["recording_id"])
        require(record is not None and record["session_id"] == row["session_id"], "An example has conflicting session identity.")
        require(row["target"] in CLASSES and row["metadata"]["role"] == "supervised_target", "Only supervised moving examples can enter training.")
        require(set(row["features"]) == set(COLUMNS), "Unexpected model inputs.")
        values = [row["features"][name] for name in COLUMNS]
        require(all(type(v) in (int, float) and math.isfinite(v) for v in values), "Nonfinite model input.")
        matrix.append(values)
        targets.append(row["target"])
        groups.append(row["session_id"])
    require(set(targets) == set(CLASSES) and len(set(groups)) >= 2, "All targets and multiple sessions are required.")
    return np.asarray(matrix, dtype=np.float64), np.asarray(targets), np.asarray(groups), rows, by_record


def folds(matrix, targets, groups):
    splits = list(LeaveOneGroupOut().split(matrix, targets, groups))
    coverage = np.zeros(len(targets), dtype=int)
    for train, held in splits:
        require(not set(groups[train]) & set(groups[held]), "Session leakage in validation.")
        require(set(targets[train]) == set(CLASSES), "A training fold is missing a target class.")
        coverage[held] += 1
    require(np.all(coverage == 1), "Each example must be held out exactly once.")
    return splits


def train(payload):
    runtime = environment()
    matrix, targets, groups, rows, records = dataset(payload)
    splits = folds(matrix, targets, groups)
    session_codes = {r["session_id"]: f'S{r["session_number"]:02d}' for r in records.values()}
    results, serialized = {}, {}
    with threadpool_limits(limits=1), warnings.catch_warnings():
        warnings.simplefilter("error", ConvergenceWarning)
        for name, template in models().items():
            predictions = np.full(len(rows), "", dtype=object)
            fold_reports = []
            for train_indices, held in splits:
                estimator = clone(template)
                estimator.fit(matrix[train_indices], targets[train_indices])
                predicted = estimator.predict(matrix[held])
                predictions[held] = predicted
                fold_reports.append({
                    "held_session": session_codes[groups[held][0]],
                    "training_sessions": sorted(session_codes[g] for g in set(groups[train_indices])),
                    "training_examples": len(train_indices), "held_examples": len(held),
                    "actual_class_counts": counts(targets[held]), "training_class_counts": counts(targets[train_indices]),
                    "metrics": metrics(targets[held], predicted),
                })
            results[name] = {
                "parameters": {k: v for k, v in template.get_params().items() if type(v) in (int, float, str, bool) or v is None},
                "pooled_out_of_session": metrics(targets, predictions), "folds": fold_reports,
                "out_of_session_predictions": [
                    {"interval_id": row["interval_id"], "recording_id": row["recording_id"],
                     "code": records[row["recording_id"]]["code"], "session": session_codes[row["session_id"]],
                     "start_ms": row["metadata"]["start_ms"], "end_ms": row["metadata"]["end_ms"],
                     "actual": row["target"], "predicted": str(predictions[i])} for i, row in enumerate(rows)
                ],
            }
            # Refit all development rows for a saved candidate, never for reported scores.
            fitted = clone(template).fit(matrix, targets)
            blob = pickle.dumps({"model": fitted, "feature_columns": COLUMNS, "class_order": CLASSES,
                                 "version": VERSION, "environment": runtime}, protocol=5)
            require(np.array_equal(pickle.loads(blob)["model"].predict(matrix), fitted.predict(matrix)), "Saved candidate round trip failed.")
            serialized[name] = {"format": "trusted-local-python-pickle-v5", "sha256": hashlib.sha256(blob).hexdigest(),
                                "bytes_base64": base64.b64encode(blob).decode("ascii")}
    best = max(results, key=lambda name: results[name]["pooled_out_of_session"]["macro_f1_fixed_seven_classes"])
    return {
        "schema": VERSION, "environment": runtime, "class_order": CLASSES, "feature_columns": COLUMNS,
        "source_sha256": hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest(),
        "protocol": {"validation": "leave-one-research-session-out", "random_seed": SEED,
                     "selection_metric": "pooled out-of-session macro F1 across seven fixed classes",
                     "hyperparameter_search": False, "final_evaluation_used": False,
                     "interpretation": "Development comparison on human-selected isolated intervals; not continuous-driving accuracy.",
                     "final_refit": "All development examples only; refit training accuracy is not reported."},
        "summary": {"examples": len(rows), "features": len(COLUMNS), "sessions": sorted(session_codes.values()),
                    "recordings": len(records), "classes": counts(targets)},
        "best_development_model": best, "comparisons": results, "models": serialized,
    }


if __name__ == "__main__":
    try:
        result = train(json.load(sys.stdin))
        json.dump(result, sys.stdout, allow_nan=False, separators=(",", ":"))
    except (ValueError, KeyError, TypeError, ConvergenceWarning) as error:
        # Deliberately avoid raw examples, feature values and traceback data in logs.
        print(f"Pilot training stopped: {type(error).__name__}.", file=sys.stderr)
        sys.exit(1)
