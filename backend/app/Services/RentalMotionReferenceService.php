<?php

namespace App\Services;

use App\Models\TelematicsSetupSession;
use Illuminate\Validation\ValidationException;

class RentalMotionReferenceService
{
    public function reference(TelematicsSetupSession $setup): array
    {
        $calibration = app(TelematicsCalibrationService::class);
        $projection = $calibration->projection($setup);
        $steps = $calibration->latestSteps($setup);
        $stationary = $steps->get('stationary_calibration');
        $forwardStep = $steps->get('forward_calibration');
        if (($projection['profile']['id'] ?? null) !== 'rc_demo'
            || ($stationary?->evidence['protocol_version'] ?? null) !== 4
            || ($forwardStep?->evidence['protocol_version'] ?? null) !== 4
            || ! $projection['parkedAcceleration'] || ! ($projection['reference']['forward'] ?? null)) {
            throw ValidationException::withMessages(['monitoring' => 'Complete native stationary and forward-reference setup in RC mode first.']);
        }
        $up = $this->unit(array_map(fn ($n) => -$n, $projection['reference']['down']));
        $forward = $projection['reference']['forward'];
        $dot = array_sum(array_map(fn ($a, $b) => $a * $b, $forward, $up));
        $forward = $this->unit(array_map(fn ($f, $u) => $f - $dot * $u, $forward, $up));
        [$a, $b, $c] = $forward;
        [$x, $y, $z] = $up;
        $right = $this->unit([$b * $z - $c * $y, $c * $x - $a * $z, $a * $y - $b * $x]);
        $evidence = $stationary->evidence;
        $bias = array_map(function ($axis) use ($evidence) {
            $n = $evidence['rotation_mean_'.$axis] ?? null;
            abort_unless(is_numeric($n) && is_finite((float) $n), 422, 'Repeat stationary calibration.');

            // Calibration summaries use degrees/s; native pipeline uses radians/s.
            return deg2rad((float) $n);
        }, ['x', 'y', 'z']);

        return ['rotation_rfu' => [$right, $forward, $up], 'acceleration_mean' => $projection['parkedAcceleration'], 'gyroscope_mean' => $bias];
    }

    private function unit(array $v): array
    {
        abort_unless(count($v) === 3 && count(array_filter($v, fn ($n) => is_numeric($n) && is_finite((float) $n))) === 3, 422, 'Repeat calibration.');
        $length = sqrt(array_sum(array_map(fn ($n) => $n * $n, $v)));
        abort_unless($length > 1e-6, 422, 'Repeat calibration.');

        return array_map(fn ($n) => $n / $length, $v);
    }
}
