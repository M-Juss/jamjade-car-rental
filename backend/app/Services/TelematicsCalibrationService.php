<?php

namespace App\Services;

use App\Enums\RentalType;
use App\Enums\TelematicsSetupStatus;
use App\Enums\TelematicsSetupStepStatus;
use App\Enums\TelematicsSetupStepType;
use App\Http\Requests\Telematics\StoreSetupAttemptRequest;
use App\Models\TelematicsSetupSession;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class TelematicsCalibrationService
{
    public function __construct(private readonly TelematicsCalibrationProfileService $profiles) {}

    public const STEPS = ['stationary_calibration', 'forward_calibration'];

    public const PROTOCOL_VERSION = 4;

    private const SAMPLE_RATE = 50;

    // Retained only to read persisted attempts; these are no longer rental checks.
    public const RETIRED_STEPS = ['braking_calibration', 'left_turn_calibration', 'right_turn_calibration'];

    public function latestSteps(TelematicsSetupSession $session)
    {
        $session->loadMissing('steps', 'booking.assignedDriver', 'booking.assignment');
        $attempts = $session->currentAttempts();
        if ($session->booking?->rental_type === RentalType::OwnersDriver) {
            $operatorId = app(TelematicsOperatorService::class)->operatorId($session->booking);
            $attempts = $attempts->filter(fn ($step) => (int) $step->actor_user_id === (int) $operatorId);
        }
        $latest = $attempts->sortByDesc('attempt_number')->unique('step_type')
            ->keyBy(fn ($step) => $step->step_type->value);
        $previousId = $latest->reject(fn ($step) => in_array($step->step_type->value, [...self::STEPS, ...self::RETIRED_STEPS], true))->max('id') ?? 0;

        // Re-running any device check or earlier calibration invalidates later
        // calibration projections, while retaining every immutable attempt.
        foreach (self::STEPS as $type) {
            $step = $latest->get($type);
            if (! $step || $step->id <= $previousId
                || ($session->status === TelematicsSetupStatus::InProgress && isset($step->evidence['protocol_version']) && (int) $step->evidence['protocol_version'] !== self::PROTOCOL_VERSION)
                || ($session->status !== TelematicsSetupStatus::Released && ! $this->profiles->matches($step->evidence))) {
                $latest->forget($type);
                $previousId = PHP_INT_MAX;
            } elseif ($step->status !== TelematicsSetupStepStatus::Passed) {
                $previousId = PHP_INT_MAX;
            } else {
                $previousId = $step->id;
            }
        }

        return $latest;
    }

    public function requiresProfileRestart(TelematicsSetupSession $session): bool
    {
        if ($session->status !== TelematicsSetupStatus::ReadyForRelease) {
            return false;
        }
        $stationary = $session->relationLoaded('steps')
            ? $session->steps->where('step_type', TelematicsSetupStepType::StationaryCalibration)->sortByDesc('id')->first()
            : $session->latestStationary;

        return $stationary && ! $this->profiles->matches($stationary->evidence);
    }

    public function effectiveStatus(?TelematicsSetupSession $session): ?TelematicsSetupStatus
    {
        return $session && $this->requiresProfileRestart($session) ? TelematicsSetupStatus::InProgress : $session?->status;
    }

    public function projection(?TelematicsSetupSession $session): array
    {
        $latest = $session ? $this->latestSteps($session) : collect();
        $deviceReady = collect(TelematicsSetupService::requiredSteps())
            ->reject(fn ($type) => in_array($type->value, self::STEPS, true))
            ->every(fn ($type) => $latest->get($type->value)?->status === TelematicsSetupStepStatus::Passed);
        $stationary = $latest->get('stationary_calibration');
        $profile = $this->profiles->active();
        if ($session?->status === TelematicsSetupStatus::Released) {
            $profile = $stationary?->evidence['calibration_profile'] ?? [
                'id' => 'legacy', 'revision' => null, 'fingerprint' => null, 'settings' => $profile['settings'],
            ];
        }
        $limits = $profile['settings'];
        $forward = $latest->get('forward_calibration');
        $reference = $forward?->status === TelematicsSetupStepStatus::Passed
            ? ($forward->evidence['mount_reference'] ?? null)
            : null;
        $reference ??= $stationary?->evidence['mount_reference'] ?? null;
        $noiseBaseline = $stationary?->status === TelematicsSetupStepStatus::Passed
            ? ($stationary->evidence['noise_baseline'] ?? null) : null;
        $parkedAcceleration = $stationary?->status === TelematicsSetupStepStatus::Passed
            ? ($stationary->evidence['parked_acceleration'] ?? null) : null;

        return [
            'protocolVersion' => $session?->status === TelematicsSetupStatus::Released && ! $parkedAcceleration ? 3 : self::PROTOCOL_VERSION,
            'profile' => $this->profiles->identity($profile),
            'context' => $session ? $this->context($session) : null,
            'nextStep' => $deviceReady ? collect(self::STEPS)->first(fn ($type) => $latest->get($type)?->status !== TelematicsSetupStepStatus::Passed) : null,
            'captureSeconds' => $limits['capture_seconds'],
            'completionLimits' => [
                'minimumDurationMs' => (int) ($limits['movement_minimum_duration_ms'] ?? 1000),
                'minimumCoverage' => (float) $limits['minimum_coverage'],
                'minimumSamplesPerSecond' => (int) $limits['minimum_samples_per_second'],
            ],
            'stationaryLimits' => [
                'linearRms' => (float) $limits['stationary_linear_rms'],
                'rotationPeak' => (float) $limits['stationary_rotation_peak'],
                'yawDegrees' => (float) $limits['stationary_yaw_degrees'],
                'tiltDegrees' => (float) $limits['maximum_tilt_degrees'],
                'maxGapMs' => (float) $limits['maximum_gap_ms'],
            ],
            'forwardLimits' => [
                'acceleration' => max(
                    (float) ($limits['minimum_forward_acceleration'] ?? $limits['minimum_longitudinal_acceleration']),
                    ($noiseBaseline['horizontalRms'] ?? 0) * (float) $limits['parked_noise_multiplier'],
                ),
                'durationMs' => (float) $limits['minimum_forward_duration_ms'],
                'coherence' => (float) $limits['minimum_forward_coherence'],
                'samples' => (int) ($limits['minimum_forward_samples'] ?? 5),
            ],
            'movementLimits' => $this->movementLimits($limits),
            'reference' => $reference,
            'noiseBaseline' => $noiseBaseline,
            'parkedAcceleration' => $parkedAcceleration,
        ];
    }

    private function movementLimits(array $limits): array
    {
        return [
            'tiltDegrees' => (float) ($limits['movement_maximum_tilt_degrees'] ?? $limits['maximum_tilt_degrees']),
            'rotationPeak' => (float) ($limits['forward_maximum_rotation_peak'] ?? $limits['stationary_rotation_peak']),
            'yawDegrees' => (float) ($limits['forward_maximum_yaw_degrees'] ?? $limits['stationary_yaw_degrees']),
            'forwardAccelerationOnly' => (bool) ($limits['forward_acceleration_only'] ?? false),
            'brakingAcceleration' => (float) $limits['minimum_longitudinal_acceleration'],
            'turnDegrees' => (float) $limits['minimum_turn_degrees'],
            'oppositeTurnDegrees' => (float) $limits['maximum_opposite_turn_degrees'],
            'turnDominance' => (float) ($limits['minimum_turn_dominance'] ?? 0),
        ];
    }

    public function context(TelematicsSetupSession $session): string
    {
        $session->loadMissing('steps');
        $ids = $session->currentAttempts()->sortByDesc('attempt_number')->unique('step_type')->sortBy(fn ($step) => $step->step_type->value)->pluck('id')->implode(',');

        $fingerprint = $this->profiles->active()['fingerprint'];

        $boundary = $session->reset_through_step_id ? ":{$session->reset_through_step_id}" : '';

        return hash_hmac('sha256', "{$session->id}:{$ids}:{$fingerprint}{$boundary}", config('app.key'));
    }

    public function evaluate(TelematicsSetupSession $session, TelematicsSetupStepType $type, array $evidence): array
    {
        if (! in_array($type->value, self::STEPS, true)) {
            throw ValidationException::withMessages(['step' => ['This exercise is no longer part of rental calibration.']]);
        }
        $rules = StoreSetupAttemptRequest::calibrationEvidenceRules();
        // The same request contract applies when invoked through a service.
        $nested = ['evidence' => ['required', 'array:'.implode(',', array_keys($rules))]];
        foreach ($rules as $key => $rule) {
            $nested["evidence.{$key}"] = $rule;
        }
        $values = Validator::make(['evidence' => $evidence], $nested)->validate()['evidence'];
        $projection = $this->projection($session);
        $restarting = $type === TelematicsSetupStepType::StationaryCalibration && $projection['nextStep'] !== null;
        if (! hash_equals($this->context($session), $values['context']) || (! $restarting && $projection['nextStep'] !== $type->value)) {
            throw ValidationException::withMessages(['step' => ['Setup changed. Refresh and repeat the current calibration step.']]);
        }

        $start = CarbonImmutable::parse($values['started_at']);
        $end = CarbonImmutable::parse($values['ended_at']);
        $duration = $start->diffInMilliseconds($end);
        $profile = $this->profiles->active();
        $limits = $profile['settings'];
        $movement = $this->movementLimits($limits);
        $tiltLimit = $type === TelematicsSetupStepType::StationaryCalibration
            ? $limits['maximum_tilt_degrees'] : $movement['tiltDegrees'];
        $expectedMs = $limits['capture_seconds'][$type->value] * 1000;
        $stationary = $type === TelematicsSetupStepType::StationaryCalibration;
        $minimumMs = $stationary ? $expectedMs - 250 : $limits['movement_minimum_duration_ms'];
        $qualityMs = $stationary ? $expectedMs : $duration;
        $gravity = [$values['gravity_x'], $values['gravity_y'], $values['gravity_z']];
        $norm = sqrt(array_sum(array_map(fn ($value) => $value ** 2, $gravity)));
        $referenceDown = $projection['reference']['down'] ?? null;
        $meanTilt = $referenceDown ? rad2deg(acos(max(-1, min(1, array_sum(array_map(
            fn ($value, $reference) => ($value / max($norm, 0.001)) * $reference,
            $gravity, $referenceDown,
        )))))) : 0;
        $forward = [$values['forward_x'], $values['forward_y'], $values['forward_z']];
        $forwardNorm = sqrt(array_sum(array_map(fn ($value) => $value ** 2, $forward)));
        $forwardVertical = $referenceDown ? abs(array_sum(array_map(fn ($value, $down) => $value * $down, $forward, $referenceDown))) : 0;
        $linearMeanSquared = $values['linear_mean_x'] ** 2 + $values['linear_mean_y'] ** 2 + $values['linear_mean_z'] ** 2;
        $rotationMeanSquared = $values['rotation_mean_x'] ** 2 + $values['rotation_mean_y'] ** 2 + $values['rotation_mean_z'] ** 2;
        $failure = match (true) {
            $end->isAfter(now()->addSeconds(10)), $end->isBefore(now()->subSeconds($limits['maximum_age_seconds'])) => 'The capture is no longer current. Repeat this step.',
            $duration < $minimumMs, $duration > $expectedMs + 2000 => 'The recording was interrupted. Repeat this step.',
            $values['sensor_duration_ms'] < $qualityMs * $limits['minimum_coverage'],
            $values['sensor_duration_ms'] > $duration + 250,
            $values['sample_count'] < ($qualityMs / 1000) * $limits['minimum_samples_per_second'],
            $values['sample_count'] > ($duration / 1000) * self::SAMPLE_RATE + 2,
            $values['max_gap_ms'] > $limits['maximum_gap_ms'] => 'Motion readings were interrupted or too sparse. Repeat this step.',
            $values['yaw_left_degrees'] + $values['yaw_right_degrees'] > $values['rotation_peak'] * $values['sensor_duration_ms'] / 1000 + 0.01,
            abs($values['linear_rms'] ** 2 - $linearMeanSquared - $values['linear_stddev'] ** 2) > 0.0001,
            abs($values['rotation_rms'] ** 2 - $rotationMeanSquared - $values['rotation_stddev'] ** 2) > 0.0001,
            $values['horizontal_rms'] > $values['linear_rms'] + 0.0001,
            $values['rotation_rms'] > $values['rotation_peak'] + 0.0001,
            max(abs($values['longitudinal_min']), abs($values['longitudinal_max'])) > $values['linear_rms'] * sqrt($values['sample_count']) + 0.01 => 'The motion summary is inconsistent. Repeat this step.',
            $norm < 8, $norm > 12 => 'Gravity readings were not usable. Keep the phone secured and repeat this step.',
            $type !== TelematicsSetupStepType::StationaryCalibration && ! $referenceDown => 'Restart stationary calibration to establish the phone position.',
            $type === TelematicsSetupStepType::ForwardCalibration && ! $projection['noiseBaseline'] => 'Repeat stationary calibration to measure parked vibration.',
            $type === TelematicsSetupStepType::ForwardCalibration && ! $projection['parkedAcceleration'] => 'Repeat stationary calibration to restore the parked reference.',
            $values['max_tilt_degrees'] > $tiltLimit,
            $type !== TelematicsSetupStepType::StationaryCalibration && $meanTilt > $tiltLimit => 'The phone position changed too much. Secure it and restart calibration.',
            default => null,
        };

        $failure ??= match ($type) {
            TelematicsSetupStepType::StationaryCalibration => $values['linear_rms'] > $limits['stationary_linear_rms'] || $values['rotation_peak'] > $limits['stationary_rotation_peak']
                || $limits['stationary_yaw_degrees'] < $values['yaw_left_degrees'] + $values['yaw_right_degrees']
                ? 'Parked vibration was too high. Keep the vehicle parked, secure the phone and repeat this step.' : null,
            TelematicsSetupStepType::ForwardCalibration => $forwardNorm < $projection['forwardLimits']['acceleration']
                || $values['forward_duration_ms'] < $limits['minimum_forward_duration_ms']
                || $values['forward_sample_count'] < $projection['forwardLimits']['samples']
                || $values['forward_sample_count'] > $values['sample_count']
                || $values['forward_sample_count'] > $values['forward_duration_ms'] / 1000 * self::SAMPLE_RATE + 2
                || $values['forward_duration_ms'] > $values['sensor_duration_ms']
                || $forwardNorm > $values['linear_rms'] * sqrt($values['sample_count'] / max(1, $values['forward_sample_count'])) + 0.01
                || $forwardVertical > $forwardNorm * 0.05
                || $values['forward_coherence'] < $limits['minimum_forward_coherence']
                || (! $movement['forwardAccelerationOnly'] && (
                    $movement['yawDegrees'] < $values['yaw_left_degrees'] + $values['yaw_right_degrees']
                    || $values['rotation_peak'] > $movement['rotationPeak']
                ))
                ? 'A clear forward movement was not recorded. Repeat only when staff says it is safe.' : null,
            default => 'This calibration step is unavailable.',
        };

        // Keep only bounded summaries. No motion samples or location history.
        unset($values['context']);
        $values['calibration_profile'] = $profile;
        if ($failure === null && $type === TelematicsSetupStepType::StationaryCalibration) {
            // Native linear = raw accelerometer minus Android gravity.
            // The summary's gravity points down, so linear minus down recovers raw.
            $parked = array_map(fn ($axis, $i) => (float) $values["linear_mean_{$axis}"] - $gravity[$i], ['x', 'y', 'z'], [0, 1, 2]);
            $parkedNorm = sqrt(array_sum(array_map(fn ($value) => $value ** 2, $parked)));
            if ($parkedNorm < 8 || $parkedNorm > 12) {
                return [TelematicsSetupStepStatus::Failed, $values, 'Parked acceleration was not usable. Keep the phone secured and repeat this step.'];
            }
            $down = array_map(fn ($value) => -$value / $parkedNorm, $parked);
            $values['mount_reference'] = ['down' => $down, 'forward' => null];
            $values['parked_acceleration'] = $parked;
            $values['noise_baseline'] = [
                'linearRms' => (float) $values['linear_rms'],
                'horizontalRms' => (float) $values['horizontal_rms'],
                'linearStddev' => (float) $values['linear_stddev'],
                'rotationRms' => (float) $values['rotation_rms'],
                'rotationStddev' => (float) $values['rotation_stddev'],
            ];
        }

        if ($failure === null && $type === TelematicsSetupStepType::ForwardCalibration) {
            $values['mount_reference'] = ['down' => $referenceDown, 'forward' => array_map(fn ($value) => $value / $forwardNorm, $forward)];
        }

        return [$failure ? TelematicsSetupStepStatus::Failed : TelematicsSetupStepStatus::Passed, $values, $failure];
    }
}
