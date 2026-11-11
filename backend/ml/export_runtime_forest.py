"""Export the frozen forest's exact trees, never refit or read held-out examples."""
import hashlib
import json
import pickle
import subprocess
from evaluate_yaw_forest import load_candidate, provenance, BACKEND


def document():
    candidate, blob = load_candidate(provenance())
    model = pickle.loads(blob)
    return model, {
        "version": "rc-runtime-forest-v1", "model_sha256": candidate["model_sha256"],
        "feature_count": int(model.n_features_in_), "classes": model.classes_.tolist(),
        "trees": [{"left": tree.tree_.children_left.tolist(), "right": tree.tree_.children_right.tolist(),
                   "feature": tree.tree_.feature.tolist(), "threshold": tree.tree_.threshold.tolist(),
                   "value": tree.tree_.value[:, 0, :].tolist()} for tree in model.estimators_],
    }


if __name__ == "__main__":
    model, forest = document()
    encoded = json.dumps(forest, allow_nan=False, separators=(",", ":"))
    digest = hashlib.sha256(encoded.encode()).hexdigest()
    php = r'''
    require "vendor/autoload.php";
    $app = require "bootstrap/app.php";
    $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
    if (!$app->isLocal()) throw new RuntimeException("Local export required.");
    $path = Illuminate\Support\Facades\Storage::disk('local')->path('rc-research-v2/datasets/models/pilot-split-v3-yaw-forest-v1/runtime-forest-v1.json.encrypted');
    $json = stream_get_contents(STDIN);
    if (file_exists($path)) {
        if (Illuminate\Support\Facades\Crypt::decryptString(file_get_contents($path)) !== $json)
            throw new RuntimeException("Existing runtime differs.");
        exit;
    }
    $stage = tempnam(dirname($path), '.runtime-');
    try {
        chmod($stage,0600);
        file_put_contents($stage,Illuminate\Support\Facades\Crypt::encryptString($json),LOCK_EX);
        if (!link($stage,$path)) throw new RuntimeException("Runtime publish failed.");
    } finally { unlink($stage); }
    '''
    subprocess.run(["php", "-r", php], input=encoded, text=True, cwd=BACKEND, check=True)
    print(json.dumps({"runtime_sha256": digest, "trees": len(forest["trees"]), "bytes": len(encoded)}))
