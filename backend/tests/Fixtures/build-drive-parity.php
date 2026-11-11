<?php

// Deterministic synthetic oracle, never private recordings. Run from backend with PHP.
use App\Services\DriveMonitoringFeatureService;
use App\Services\RcMotionProcessing;
use Illuminate\Contracts\Console\Kernel;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$cases = [];
foreach ([false, true] as $gap) {
    $reference = ['rotation_rfu' => [[1, 0, 0], [0, cos(.2), -sin(.2)], [0, sin(.2), cos(.2)]],
        'acceleration_mean' => [.2, -.1, 9.78], 'gyroscope_mean' => [.01, .02, -.01]];
    $a = $g = [];
    for ($i = 0; $i < 360; $i++) {
        $ms = $i * 20 + ($i % 3 - 1) * 2;
        if ($ms < 0) {
            $ms = 0;
        }
        if (! $gap || $ms < 2700 || $ms > 2860) {
            $a[] = ['sequence' => count($a), 'sensor_timestamp_ns' => (string) (1000000000 + $ms * 1000000),
                'values' => [.2 + sin($ms / 430) * .8, -.1 + sin($ms / 320), 9.78 + cos($ms / 170) * .1]];
        }
        $time = $ms + 7;
        $g[] = ['sequence' => count($g), 'sensor_timestamp_ns' => (string) (1000000000 + $time * 1000000),
            'values' => [.01 + sin($time / 800) * .1, .02 + cos($time / 500) * .1, -.01 + sin($time / 210) * .6]];
    }
    $result = app(RcMotionProcessing::class)->calculate($a, $g, '1000000000', ['start_ms' => 0, 'end_ms' => 7180, 'cutoff_hz' => 5], $reference);
    $rows = [];
    $windows = [];
    $valid = 0;
    foreach ($result['signals']['acceleration']['after'] as $i => $accel) {
        $gyro = $result['signals']['gyroscope']['after'][$i];
        $row = [$accel['time'], $accel['x'], $accel['y'], $accel['z'], $gyro['x'], $gyro['y'], $gyro['z']];
        $ok = ! in_array(null, $row, true);
        $rows[] = $ok ? $row : null;
        $valid = $ok ? $valid + 1 : 0;
        if (! $ok || ($i + 1) % 10 !== 0) {
            continue;
        }
        foreach ([20, 40, 80, 160, 280] as $size) {
            if ($valid < $size) {
                continue;
            }
            $slice = array_slice($rows, $i + 1 - $size, $size);
            $windows[] = ['id' => 'w-'.$slice[0][0].'-'.($row[0] + 20), 'features' => app(DriveMonitoringFeatureService::class)->extract($slice)];
        }
    }
    $cases[] = compact('reference', 'a', 'g', 'windows');
}
echo json_encode($cases, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION);
