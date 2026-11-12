<?php

return [
    'handover_test_mode' => env('TELEMATICS_HANDOVER_TEST_MODE', false),
    'early_start_test_mode' => env('RENTAL_EARLY_START_TEST_MODE', false),
    'calibration_profile' => env('TELEMATICS_CALIBRATION_PROFILE', 'standard'),
    'hosted_rc_demo' => env('TELEMATICS_HOSTED_RC_DEMO', false),
    'driving_report_sync_hours' => 24,
    // Fleet freshness display only; stale updates do not diagnose GPS/network loss.
    'fleet_location_recent_seconds' => 120,
    'foreground_location' => [
        'consent_version' => 3,
        'upload_interval_seconds' => 3,
        'maximum_accuracy_meters' => 50,
        'maximum_age_seconds' => 60,
        'future_skew_seconds' => 10,
        'retention_hours' => 24,
    ],
    // Provisional RC workflow demonstration settings, not learned driving limits.
    // Keep parked reference checks unchanged; also available in an explicit hosted RC demo.
    'calibration_rc_overrides' => [
        'capture_seconds' => [
            'forward_calibration' => 3,
            'braking_calibration' => 3,
            'left_turn_calibration' => 3,
            'right_turn_calibration' => 3,
        ],
        'minimum_forward_coherence' => 0.7,
        'movement_maximum_tilt_degrees' => 60,
        'forward_maximum_rotation_peak' => 120,
        'forward_maximum_yaw_degrees' => 45,
        'minimum_turn_degrees' => 10,
        'maximum_opposite_turn_degrees' => 20,
        'minimum_turn_dominance' => 1.5,
    ],

    // Development operational defaults for pre-release setup checks. These are
    // not driving-behavior or scientific thresholds.
    'setup_gps_max_age_seconds' => 60,
    'setup_gps_max_accuracy_meters' => 50,
    'setup_gps_future_skew_seconds' => 10,
    // Initial calibration quality limits; physical Android/iOS validation is
    // required before deployment. These do not classify driving behaviour.
    'calibration' => [
        'capture_seconds' => [
            'stationary_calibration' => 6,
            'forward_calibration' => 12,
            'braking_calibration' => 12,
            'left_turn_calibration' => 15,
            'right_turn_calibration' => 15,
        ],
        'minimum_samples_per_second' => 8,
        // Movement may finish early once enough real evidence is available.
        'movement_minimum_duration_ms' => 1000,
        'minimum_coverage' => 0.85,
        'maximum_gap_ms' => 500,
        'maximum_age_seconds' => 60,
        'maximum_tilt_degrees' => 10,
        'stationary_linear_rms' => 0.35,
        'stationary_rotation_peak' => 6,
        'stationary_yaw_degrees' => 5,
        'forward_maximum_rotation_peak' => 60,
        'forward_maximum_yaw_degrees' => 180,
        'minimum_longitudinal_acceleration' => 0.5,
        'minimum_forward_acceleration' => 0.5,
        'minimum_forward_duration_ms' => 120,
        'minimum_forward_samples' => 7,
        'minimum_forward_coherence' => 0.9,
        // Engineering margin over the accepted parked horizontal RMS, not a
        // statistical guarantee. Existing stationary caps still reject noise.
        'parked_noise_multiplier' => 3,
        'minimum_turn_degrees' => 20,
        'maximum_opposite_turn_degrees' => 10,
    ],
    'geofence_max_accuracy_meters' => 50,
    'geofence_max_age_seconds' => 60,
    'geofence_boundary_buffer_meters' => 0,
    'geofence_confirmation_points' => 2,
    'geofence_confirmation_seconds' => 3,
];
