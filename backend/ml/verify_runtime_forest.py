"""Probability parity on development data and synthetic float32 split boundaries."""
import json
import subprocess

import numpy as np
from threadpoolctl import threadpool_limits
from export_runtime_forest import document, BACKEND
from compare_yaw_phases import development_rows, temporal_values
from train_pilot_v2 import COLUMNS

model, forest = document()
rows, intervals = development_rows()
matrix = [[*(row["features"][name] for name in COLUMNS),
           *temporal_values(intervals[row["interval_id"]]["samples"])] for row in rows]
development_count = len(matrix)
matrix.extend(np.random.default_rng(42).normal(size=(128,35)).tolist())
for tree in forest["trees"][:16]:
    for feature, threshold in zip(tree["feature"], tree["threshold"], strict=True):
        if feature < 0:
            continue
        value = np.float32(threshold)
        for boundary in [np.nextafter(value, np.float32(-np.inf)), value, np.nextafter(value, np.float32(np.inf))]:
            row = [0.] * 35
            row[feature] = float(boundary)
            matrix.append(row)
with threadpool_limits(limits=1):
    expected = model.predict_proba(matrix)
php = r'''
require "vendor/autoload.php";
$app=require "bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
echo json_encode(app(App\Services\RcRuntimeForestService::class)->probabilities(json_decode(stream_get_contents(STDIN),true)),JSON_THROW_ON_ERROR);
'''
actual = []
for start in range(0,len(matrix),100):
    result = subprocess.run(["php","-r",php], cwd=BACKEND, input=json.dumps(matrix[start:start+100]), text=True, stdout=subprocess.PIPE, check=True)
    actual.extend(json.loads(result.stdout))
actual = np.asarray(actual)
assert actual.shape == expected.shape
assert np.allclose(actual, expected, rtol=0, atol=1e-12)
assert np.array_equal(np.argmax(actual,axis=1), np.argmax(expected,axis=1))
print(json.dumps({"development_examples":development_count,"total_examples":len(matrix),
                  "maximum_probability_error":float(np.max(np.abs(actual-expected))),"classifications_match":True}))
