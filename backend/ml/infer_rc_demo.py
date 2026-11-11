"""Private RC demo worker. One bounded JSON request and response per process."""

import json
import math
import pickle
import sys

from threadpoolctl import threadpool_limits

from evaluate_yaw_forest import FEATURES, load_candidate, provenance
from train_pilot_v2 import require

VERSION = "rc-demo-inference-v1"
MAX_BYTES = 1024 * 1024
MAX_WINDOWS = 100


def validate(payload):
    require(set(payload) == {"version", "windows"} and payload["version"] == VERSION,
            "Unsupported demo inference request.")
    windows = payload["windows"]
    require(type(windows) is list and 0 < len(windows) <= MAX_WINDOWS,
            "Unsupported window count.")
    seen = set()
    for window in windows:
        require(type(window) is dict and set(window) == {"id", "features"},
                "Unsupported window fields.")
        identity = window["id"]
        require(type(identity) is str and 0 < len(identity) <= 100 and identity not in seen,
                "Invalid or duplicate window identity.")
        seen.add(identity)
        features = window["features"]
        require(type(features) is list and len(features) == len(FEATURES),
                "Feature order or length differs.")
        require(all(type(value) in (int, float) and math.isfinite(value) for value in features),
                "Features must be finite numbers.")
    return windows


def infer(payload):
    windows = validate(payload)
    candidate, blob = load_candidate(provenance())
    with threadpool_limits(limits=1):
        model = pickle.loads(blob)
        votes = model.predict_proba([window["features"] for window in windows])
    predictions = []
    for window, scores in zip(windows, votes, strict=True):
        index = int(scores.argmax())
        predictions.append({
            "id": window["id"], "class": str(model.classes_[index]),
            "vote": float(scores[index]),
        })
    return {"version": VERSION, "model_sha256": candidate["model_sha256"],
            "predictions": predictions}


if __name__ == "__main__":
    try:
        request = sys.stdin.buffer.read(MAX_BYTES + 1)
        require(len(request) <= MAX_BYTES, "Request exceeds the worker limit.")
        print(json.dumps(infer(json.loads(request)), allow_nan=False))
    except (ValueError, KeyError, TypeError):
        print("RC demo inference request rejected.", file=sys.stderr)
        sys.exit(1)
