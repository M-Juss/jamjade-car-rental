<?php

return [
    'handover_test_mode' => env('TELEMATICS_HANDOVER_TEST_MODE', false),

    // Development operational defaults for pre-release setup checks. These are
    // not driving-behavior or scientific thresholds.
    'setup_gps_max_age_seconds' => 60,
    'setup_gps_max_accuracy_meters' => 50,
    'setup_gps_future_skew_seconds' => 10,
    'geofence_max_accuracy_meters' => 50,
    'geofence_max_age_seconds' => 60,
    'geofence_boundary_buffer_meters' => 10,
    'geofence_confirmation_points' => 2,
    'geofence_confirmation_seconds' => 10,
];
