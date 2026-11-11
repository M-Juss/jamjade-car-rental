"""Freeze and score the preselected temporal forest on the reserved RC split."""

import argparse
import base64
import hashlib
import json
from pathlib import Path
import pickle
import subprocess

import numpy as np
from threadpoolctl import threadpool_limits

from compare_yaw_phases import SNAPSHOT, TEMPORAL_COLUMNS, development_rows, temporal_values
from train_pilot_v2 import CLASSES, COLUMNS, environment, metrics, models, require

BACKEND = Path(__file__).resolve().parents[1]
SNAPSHOT_HASH = "7cc3b2efe0f3284af6bea681c879db0497890bdca92a69e112b6d5845dff7498"
MODEL_NAME = "balanced_random_forest"
FEATURES = [*COLUMNS, *TEMPORAL_COLUMNS]
PHP = r'''
require "vendor/autoload.php";
$app = require "bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (! $app->isLocal()) throw new RuntimeException("Local environment required.");
$snapshot = $argv[2];
$export = app(App\Services\RcPilotDatasetExportService::class);
if (in_array($argv[1], ["check-snapshot", "reserved"], true)) {
    $manifest = $export->verify($snapshot);
    if ($manifest["snapshot_sha256"] !== $argv[3]) throw new RuntimeException("Snapshot differs.");
    if ($argv[1] === "check-snapshot") exit;
    $index = array_column($manifest["recordings"], null, "recording_id");
    $features = app(App\Services\RcPilotFeatureService::class);
    foreach ($export->stream($snapshot, "final_evaluation") as $row) {
        if ($row["role"] !== "supervised_target") continue;
        $entry = $index[$row["recording_id"]];
        $row["session"] = sprintf("S%02d", $entry["session_number"]);
        $row["code"] = $entry["code"];
        $row["features"] = $features->extract($row["samples"]);
        echo json_encode($row, JSON_THROW_ON_ERROR), PHP_EOL;
    }
    exit;
}
$directory = Illuminate\Support\Facades\Storage::disk("local")
    ->path("rc-research-v2/datasets/models/".$snapshot."-yaw-forest-v1");
$path = $directory."/".$argv[3].".json.encrypted";
if ($argv[1] === "read") {
    if (is_file($path)) echo Illuminate\Support\Facades\Crypt::decryptString(file_get_contents($path));
    exit;
}
if ($argv[1] !== "write") throw new RuntimeException("Invalid storage action.");
if (!is_dir($directory) && !mkdir($directory, 0700, true)) throw new RuntimeException("Storage unavailable.");
$stage = tempnam($directory, ".pending-");
if ($stage === false) throw new RuntimeException("Staging unavailable.");
try {
    $cipher = Illuminate\Support\Facades\Crypt::encryptString(stream_get_contents(STDIN));
    if (!chmod($stage, 0600) || file_put_contents($stage, $cipher) !== strlen($cipher) || !link($stage, $path))
        throw new RuntimeException("Could not publish private artifact. Existing artifacts are immutable.");
} finally {
    unlink($stage);
}
'''


def php(action, name, payload=None):
    require(name in {"candidate", "evaluation", SNAPSHOT_HASH}, "Invalid artifact.")
    return subprocess.run(
        ["php", "-r", PHP, "--", action, SNAPSHOT, name],
        cwd=BACKEND, input=payload, stdout=subprocess.PIPE, text=True, check=True,
    ).stdout


def sha(data):
    return hashlib.sha256(data).hexdigest()


def provenance():
    return {
        "snapshot": SNAPSHOT,
        "snapshot_sha256": SNAPSHOT_HASH,
        "model": MODEL_NAME,
        "features": FEATURES,
        "classes": CLASSES,
        "runtime": environment(),
        "source_hashes": {name: sha(Path(__file__).with_name(name).read_bytes()) for name in (
            "evaluate_yaw_forest.py", "compare_yaw_phases.py", "train_pilot_v2.py", "requirements.txt",
        )},
        "statistics_source_sha256": sha(
            (BACKEND / "app/Services/RcPilotFeatureService.php").read_bytes()
        ),
    }


def feature_vector(features, samples):
    return [*(features[name] for name in COLUMNS), *temporal_values(samples)]


def freeze(identity):
    require(not php("read", "candidate"), "Candidate already frozen.")
    php("check-snapshot", SNAPSHOT_HASH)
    rows, intervals = development_rows()
    matrix = [feature_vector(row["features"], intervals[row["interval_id"]]["samples"]) for row in rows]
    targets = [row["target"] for row in rows]
    require(len(rows) == 353 and set(targets) == set(CLASSES), "Development class coverage differs.")
    with threadpool_limits(limits=1):
        model = models()[MODEL_NAME].fit(matrix, targets)
        blob = pickle.dumps(model, protocol=5)
        require(np.array_equal(model.predict(matrix), pickle.loads(blob).predict(matrix)),
                "Candidate serialization changed predictions.")
    document = {
        "identity": identity, "training_intervals": len(rows),
        "training_recordings": len({row["recording_id"] for row in rows}),
        "training_sessions": sorted({row["session_id"] for row in rows}),
        "model_sha256": sha(blob), "model_base64": base64.b64encode(blob).decode("ascii"),
    }
    php("write", "candidate", json.dumps(document, allow_nan=False))
    print("Private candidate frozen.")


def load_candidate(identity):
    candidate = json.loads(php("read", "candidate"))
    blob = base64.b64decode(candidate["model_base64"], validate=True)
    require(candidate["identity"] == identity and sha(blob) == candidate["model_sha256"],
            "Frozen candidate provenance or checksum differs.")
    return candidate, blob


def evaluate(candidate, blob):
    require(not php("read", "evaluation"), "Reserved evaluation already recorded. Use verify.")
    rows = [json.loads(line) for line in php("reserved", SNAPSHOT_HASH).splitlines()]
    sessions = sorted({row["session"] for row in rows})
    require(sessions == ["S04", "S06", "S08"] and len(rows) == len({row["interval_id"] for row in rows}) == 201,
            "Reserved evaluation inventory differs.")
    require(not set(candidate["training_sessions"]) & {row["session_id"] for row in rows},
            "Development and reserved sessions overlap.")
    matrix = [feature_vector(row["features"], row["samples"]) for row in rows]
    with threadpool_limits(limits=1):
        predicted = pickle.loads(blob).predict(matrix)
    actual = [row["target"] for row in rows]
    require(set(actual) == set(CLASSES), "Reserved class coverage differs.")
    predictions = [{key: row[key] for key in ("code", "session", "start_ms", "end_ms", "target")}
                   | {"predicted": str(label)} for row, label in zip(rows, predicted, strict=True)]
    report = {
        "model_sha256": candidate["model_sha256"], "sessions": sessions, "intervals": len(rows),
        "recordings": len({row["recording_id"] for row in rows}),
        "metrics": metrics(actual, predicted), "predictions": predictions,
    }
    php("write", "evaluation", json.dumps(report, allow_nan=False))


def verify(candidate):
    report = json.loads(php("read", "evaluation"))
    predictions = report["predictions"]
    require(report["model_sha256"] == candidate["model_sha256"]
            and report["intervals"] == len(predictions) == 201
            and report["metrics"] == metrics([row["target"] for row in predictions],
                                             [row["predicted"] for row in predictions]),
            "Saved evaluation differs.")
    return {key: value for key, value in report.items() if key != "predictions"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["freeze", "evaluate", "verify"])
    action = parser.parse_args().action
    identity = provenance()
    if action == "freeze":
        freeze(identity)
    else:
        candidate, blob = load_candidate(identity)
        if action == "evaluate":
            evaluate(candidate, blob)
        print(json.dumps(verify(candidate), allow_nan=False))
