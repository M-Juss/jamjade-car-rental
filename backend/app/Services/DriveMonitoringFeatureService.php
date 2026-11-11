<?php

namespace App\Services;

/**
 * The frozen model's 35 measured inputs, including sustained yaw phase timing.
 */
class DriveMonitoringFeatureService
{
    public function __construct(private readonly RcPilotFeatureService $statistics) {}

    public function extract(array $samples): array
    {
        $features = array_values($this->statistics->extract($samples));
        $phases = $this->yawDetails($samples)['phases'];
        $pair = [0.0, 0.0, 0.0, 0.0];
        if (count($phases) >= 2) {
            [$first, $second] = $phases;
            $smaller = min($first['area'], $second['area']);
            $pair = [
                $smaller,
                $smaller / max($first['area'], $second['area']),
                min($first['end_sample'] - $first['start_sample'], $second['end_sample'] - $second['start_sample']) * 0.02,
                ($second['start_sample'] - $first['end_sample']) * 0.02,
            ];
        }

        return [...$features, count($phases), ...$pair];
    }

    public function yawDetails(array $samples): array
    {
        $yaw = array_column($samples, 6);
        $peak = max(array_map(abs(...), $yaw));
        $threshold = 0.25 * $peak;
        $phases = [];
        if ($peak > 0) {
            $start = 0;
            $direction = $this->direction($yaw[0], $threshold);
            for ($index = 1; $index <= count($yaw); $index++) {
                $next = $index < count($yaw) ? $this->direction($yaw[$index], $threshold) : null;
                if ($next === $direction) {
                    continue;
                }
                if ($direction !== 0 && $index - $start >= 6) {
                    $area = array_sum(array_map(abs(...), array_slice($yaw, $start, $index - $start))) * 0.02;
                    $last = array_key_last($phases);
                    if ($last !== null && $phases[$last]['direction'] === ($direction > 0 ? 'positive' : 'negative')) {
                        $phases[$last]['end_sample'] = $index;
                        $phases[$last]['area'] += $area;
                    } else {
                        $phases[] = ['direction' => $direction > 0 ? 'positive' : 'negative',
                            'start_sample' => $start, 'end_sample' => $index, 'area' => $area];
                    }
                }
                $start = $index;
                $direction = $next;
            }
        }

        return ['peak_absolute_yaw' => $peak, 'threshold' => $threshold, 'phases' => $phases];
    }

    private function direction(float $value, float $threshold): int
    {
        return $value >= $threshold ? 1 : ($value <= -$threshold ? -1 : 0);
    }
}
