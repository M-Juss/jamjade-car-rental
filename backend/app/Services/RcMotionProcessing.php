<?php

namespace App\Services;

use App\Support\RcNativeProtocol as Protocol;
use Illuminate\Validation\ValidationException;

/** Bounded offline pilot. Constants form part of the immutable processing version. */
class RcMotionProcessing
{
    public const VERSION = 'rc-sync-filter-fixed-frame-v1';

    public const REUSE_VERSION = 'rc-reused-fixed-frame-v1';

    public const METHODS = ['reference' => 'horizontal-pca-v1', 'synchronization' => 'linear-grid-50hz-v1',
        'filter' => 'butterworth2-causal-50hz-v1', 'projection' => 'fixed-vehicle-frame-v1'];

    public function calculate(array $acceleration, array $gyroscope, string $origin, array $config, ?array $fixedReference = null): array
    {
        $epoch = Protocol::ns($origin);
        $a = $this->prepare($acceleration, $epoch);
        $g = $this->prepare($gyroscope, $epoch);
        $reference = $fixedReference === null ? $this->reference($a, $g, $config['ranges']) : $this->validatedReference($fixedReference);
        $step = 20000000;
        $first = (int) (ceil(round($config['start_ms'] * 1e6) / $step) * $step);
        $last = (int) round($config['end_ms'] * 1e6);
        $ai = $gi = 0;
        $rows = [];
        for ($time = $first; $time <= $last; $time += $step) {
            $rows[] = ['time' => $time / 1e6, 'sensor_timestamp_ns' => (string) ($epoch + $time),
                'acceleration' => $this->sample($a, $ai, $time, $epoch), 'gyroscope' => $this->sample($g, $gi, $time, $epoch)];
        }
        $counts = ['rows' => count($rows), 'paired' => 0];
        foreach (['acceleration', 'gyroscope'] as $channel) {
            $counts[$channel] = ['original' => 0, 'interpolated' => 0, 'gap' => 0, 'outside' => 0];
            foreach ($rows as $row) {
                $counts[$channel][$row[$channel]['state']]++;
            }
        }
        foreach ($rows as $row) {
            $counts['paired'] += (int) ($row['acceleration']['values'] !== null && $row['gyroscope']['values'] !== null);
        }
        $k = tan(M_PI * $config['cutoff_hz'] / 50);
        $norm = 1 / (1 + sqrt(2) * $k + $k * $k);
        $b = [$k * $k * $norm, 2 * $k * $k * $norm, $k * $k * $norm];
        $c = [1, 2 * ($k * $k - 1) * $norm, (1 - sqrt(2) * $k + $k * $k) * $norm];
        $signals = [];
        foreach (['acceleration', 'gyroscope'] as $channel) {
            $offset = $channel === 'acceleration' ? $reference['acceleration_mean'] : $reference['gyroscope_mean'];
            $signals[$channel] = $this->filterAndProject($rows, $channel, $b, $c, $reference['rotation_rfu'], $offset);
        }

        return ['config' => $config, 'methods' => self::METHODS,
            'settings' => ['grid_ms' => 20, 'max_interpolation_ms' => 60, 'warmup_ms' => 500,
                'reference_source' => $fixedReference === null ? 'original_independent_channels' : 'reused_original_channel_reference', 'acceleration_mode' => 'relative_to_rest',
                'acceleration_unit' => 'm/s²', 'gyroscope_unit' => 'rad/s',
                'matrix_row_order' => ['right', 'forward', 'up'], 'signal_component_order' => ['forward', 'right', 'up'], 'b' => $b, 'a' => $c],
            'reference' => $reference, 'counts' => $counts, 'rows' => $rows, 'signals' => $signals];
    }

    /** Only server-recomputed references reach this boundary; reject malformed frames rather than repair them. */
    private function validatedReference(array $reference): array
    {
        $matrix = $reference['rotation_rfu'] ?? [];
        $vector = fn ($v) => is_array($v) && array_is_list($v) && count($v) === 3
            && count(array_filter($v, fn ($n) => (is_int($n) || is_float($n)) && is_finite((float) $n))) === 3;
        if (! array_is_list($matrix) || count($matrix) !== 3 || count(array_filter($matrix, $vector)) !== 3
            || ! $vector($reference['acceleration_mean'] ?? null) || ! $vector($reference['gyroscope_mean'] ?? null)) {
            $this->invalid('The saved reference has invalid axes or resting offsets.');
        }
        foreach ($matrix as $i => $row) {
            foreach ($matrix as $j => $other) {
                if (abs($this->dot($row, $other) - (int) ($i === $j)) > 1e-6) {
                    $this->invalid('The saved reference axes are not orthonormal.');
                }
            }
        }
        if (abs($this->dot($matrix[0], $this->cross($matrix[1], $matrix[2])) - 1) > 1e-6) {
            $this->invalid('The saved reference axes must be right-handed.');
        }

        return $reference;
    }

    private function invalid(string $message): never
    {
        throw ValidationException::withMessages(['processing' => $message]);
    }

    private function prepare(array $events, int $epoch): array
    {
        if (count($events) < 2 || count($events) > 10000) {
            $this->invalid('Each channel needs 2–10,000 original readings in the window.');
        }
        $result = [];
        $previous = null;
        foreach ($events as $event) {
            $time = Protocol::ns($event['sensor_timestamp_ns']) - $epoch;
            if (count($event['values']) !== 3 || count(array_filter($event['values'], fn ($v) => is_numeric($v) && is_finite((float) $v))) !== 3
                || ! is_int($event['sequence']) || $event['sequence'] < 0) {
                $this->invalid('The original channels contain invalid readings.');
            }
            if ($previous && ($time <= $previous['ns'] || $event['sequence'] !== $previous['sequence'] + 1)) {
                $this->invalid('Repeated or backward timestamps and sequence gaps need review before processing.');
            }
            $previous = ['ns' => $time, 'sequence' => $event['sequence'], 'v' => $event['values']];
            $result[] = $previous;
        }

        return $result;
    }

    private function dot(array $a, array $b): float
    {
        return array_sum(array_map(fn ($i) => $a[$i] * $b[$i], [0, 1, 2]));
    }

    private function unit(array $v): array
    {
        $norm = sqrt($this->dot($v, $v));
        if (! is_finite($norm) || $norm < 1e-9) {
            $this->invalid('The selected reference has no usable direction.');
        }

        return array_map(fn ($x) => $x / $norm, $v);
    }

    private function cross(array $a, array $b): array
    {
        return [$a[1] * $b[2] - $a[2] * $b[1], $a[2] * $b[0] - $a[0] * $b[2], $a[0] * $b[1] - $a[1] * $b[0]];
    }

    private function mean(array $points): array
    {
        return array_map(fn ($i) => array_sum(array_column($points, $i)) / count($points), [0, 1, 2]);
    }

    private function degrees(float $cosine): float
    {
        return acos(max(-1, min(1, $cosine))) * 180 / M_PI;
    }

    private function reference(array $a, array $g, array $ranges): array
    {
        $phases = [];
        foreach ($ranges as $phase => [$start, $end]) {
            foreach (['acceleration' => $a, 'gyroscope' => $g] as $channel => $source) {
                $points = array_values(array_filter($source, fn ($p) => $start <= $p['ns'] / 1e6 && $end >= $p['ns'] / 1e6));
                if (count($points) < 2) {
                    $this->invalid('Each reference interval needs at least two readings from both channels.');
                }
                $phases[$phase][$channel] = ['points' => $points, 'mean' => $this->mean(array_column($points, 'v'))];
            }
        }
        $up = $this->unit($phases['rest']['acceleration']['mean']);
        $top = $this->unit(array_map(fn ($i) => (int) ($i === 1) - $up[1] * $up[$i], [0, 1, 2]));
        $baseRight = $this->cross($top, $up);
        $coords = array_map(fn ($p) => [$this->dot($p['v'], $baseRight), $this->dot($p['v'], $top)], $phases['starting']['acceleration']['points']);
        $n = count($coords);
        $mx = array_sum(array_column($coords, 0)) / $n;
        $my = array_sum(array_column($coords, 1)) / $n;
        $xx = $yy = $xy = 0;
        foreach ($coords as [$x, $y]) {
            $xx += ($x - $mx) ** 2 / $n;
            $yy += ($y - $my) ** 2 / $n;
            $xy += ($x - $mx) * ($y - $my) / $n;
        }
        $trace = $xx + $yy;
        $separation = hypot($xx - $yy, 2 * $xy);
        if (! is_finite($trace) || $trace < 1e-12 || $separation <= $trace * 1e-6) {
            $this->invalid('The starting interval has no distinct horizontal axis. Select a clearer start.');
        }
        $angle = atan2(2 * $xy, $xx - $yy) / 2;
        $forward = $this->unit(array_map(fn ($i) => cos($angle) * $baseRight[$i] + sin($angle) * $top[$i], [0, 1, 2]));
        $sign = $this->dot($phases['starting']['acceleration']['mean'], $forward);
        if (abs($sign) < 1e-9) {
            $this->invalid('The starting mean cannot resolve the forward direction.');
        }
        if ($sign < 0) {
            $forward = array_map(fn ($v) => -$v, $forward);
        }
        $right = $this->cross($forward, $up);
        $means = [];
        foreach ($phases as $phase => $channels) {
            $means[$phase] = ['forward' => $this->dot($channels['acceleration']['mean'], $forward),
                'right' => $this->dot($channels['acceleration']['mean'], $right),
                'acceleration_count' => count($channels['acceleration']['points']), 'gyroscope_count' => count($channels['gyroscope']['points'])];
        }
        $s = $means['starting'];
        $t = $means['stopping'];
        $length = hypot($t['forward'], $t['right']);
        $warnings = [];
        if ($ranges['rest'][1] - $ranges['rest'][0] < 5000) {
            $warnings[] = 'Resting interval < 5 s: short pilot estimate.';
        }
        if ($this->dot($forward, $top) <= 0) {
            $warnings[] = 'The estimated forward direction opposes the phone top. Review the mount and start.';
        }
        if ($t['forward'] >= 0) {
            $warnings[] = 'The stopping mean does not oppose the start. Review the selected intervals.';
        }

        return ['rotation_rfu' => [$right, $forward, $up], 'acceleration_mean' => $phases['rest']['acceleration']['mean'],
            'gyroscope_mean' => $phases['rest']['gyroscope']['mean'], 'variance_share' => ($trace + $separation) / (2 * $trace),
            'angle_from_phone_top' => $this->degrees($this->dot($forward, $top)), 'phase_means' => $means, 'warnings' => $warnings,
            'stop_opposition_degrees' => $length < 1e-9 ? null : $this->degrees(-($s['forward'] * $t['forward'] + $s['right'] * $t['right']) / (hypot($s['forward'], $s['right']) * $length))];
    }

    private function sample(array $source, int &$index, int $target, int $epoch): array
    {
        while ($index < count($source) && $source[$index]['ns'] < $target) {
            $index++;
        }
        $next = $source[$index] ?? null;
        $previous = $source[$index - 1] ?? null;
        if ($next && $next['ns'] === $target) {
            return ['state' => 'original', 'values' => $next['v'], 'source_times_ns' => [(string) ($epoch + $target), (string) ($epoch + $target)]];
        }
        if (! $previous || ! $next) {
            return ['state' => 'outside', 'values' => null, 'source_times_ns' => null];
        }
        $span = $next['ns'] - $previous['ns'];
        $times = [(string) ($epoch + $previous['ns']), (string) ($epoch + $next['ns'])];
        if ($span > 60000000) {
            return ['state' => 'gap', 'values' => null, 'source_times_ns' => $times];
        }
        $fraction = ($target - $previous['ns']) / $span;

        return ['state' => 'interpolated', 'source_times_ns' => $times,
            'values' => array_map(fn ($i) => (1 - $fraction) * $previous['v'][$i] + $fraction * $next['v'][$i], [0, 1, 2])];
    }

    private function filterAndProject(array $rows, string $channel, array $b, array $a, array $matrix, array $offset): array
    {
        $before = $after = $warmup = [];
        $x1 = null;
        $x2 = $y1 = $y2 = [];
        $start = $segments = 0;
        $project = function ($time, $v) use ($matrix, $offset) {
            if ($v === null) {
                return ['time' => $time, 'x' => null, 'y' => null, 'z' => null];
            }
            $v = array_map(fn ($i) => $v[$i] - $offset[$i], [0, 1, 2]);
            $rfu = array_map(fn ($row) => $this->dot($row, $v), $matrix);

            // Chart slots are F/R/U; the right-handed rotation matrix remains R/F/U.
            return ['time' => $time, 'x' => $rfu[1], 'y' => $rfu[0], 'z' => $rfu[2]];
        };
        foreach ($rows as $row) {
            $v = $row[$channel]['values'];
            $time = $row['time'];
            $before[] = $project($time, $v);
            if ($v === null) {
                $x1 = null;
                $after[] = $project($time, null);
                $warmup[] = false;

                continue;
            }
            if ($x1 === null) {
                $x1 = $x2 = $y1 = $y2 = $v;
                $start = $time;
                $segments++;
            }
            $out = array_map(fn ($i) => $b[0] * $v[$i] + $b[1] * $x1[$i] + $b[2] * $x2[$i] - $a[1] * $y1[$i] - $a[2] * $y2[$i], [0, 1, 2]);
            $x2 = $x1;
            $x1 = $v;
            $y2 = $y1;
            $y1 = $out;
            $warming = $time - $start < 500;
            $warmup[] = $warming;
            $after[] = $project($time, $warming ? null : $out);
        }

        return compact('before', 'after', 'warmup', 'segments');
    }
}
