<?php

namespace App\Support;

class RcResearchProtocol
{
    public const MOVEMENTS = ['stationary', 'steady_movement', 'acceleration', 'braking', 'left_turn', 'right_turn'];

    public const INTENSITIES = ['normal', 'harsh', 'not_applicable'];

    public const SAMPLE_FIELDS = ['elapsed_ms', 'acceleration_timestamp_s', 'gravity_timestamp_s', 'rotation_timestamp_s', 'linear_x', 'linear_y', 'linear_z', 'including_gravity_x', 'including_gravity_y', 'including_gravity_z', 'rotation_x', 'rotation_y', 'rotation_z', 'orientation'];

    public static function settings(): array
    {
        return ['version' => 1, 'recording_mode' => 'manual', 'requested_interval_ms' => 20,
            'minimum_duration_ms' => 1000, 'max_samples' => 10000, 'max_samples_json_bytes' => 4000000,
            'consent_version' => 1];
    }

    public static function needsIntensity(string $movement): bool
    {
        return ! in_array($movement, ['stationary', 'steady_movement'], true);
    }
}
