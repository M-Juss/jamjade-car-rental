<?php

use App\Enums\BookingStatus;
use App\Enums\TelematicsSetupStepStatus;
use App\Enums\TelematicsSetupStepType;
use App\Models\Booking;
use App\Services\BookingService;
use App\Services\TelematicsCalibrationProfileService;
use App\Services\TelematicsCalibrationService;
use App\Services\TelematicsSetupService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Storage::fake('local');
});

function calibrationReadyBooking(): Booking
{
    $booking = telematicsFoundationBooking();
    finalizeFoundationOutgoing($booking);
    $service = app(TelematicsSetupService::class);
    $session = $service->startHandover($booking, vehicleManagerUser());
    foreach (array_slice(TelematicsSetupService::requiredSteps(), 0, 6) as $type) {
        $service->recordStep($session, $type, TelematicsSetupStepStatus::Passed);
    }

    return $booking;
}

function calibrationEvidence(Booking $booking, string $type, array $overrides = []): array
{
    $profile = app(TelematicsCalibrationProfileService::class)->active();
    $seconds = $profile['settings']['capture_seconds'][$type];
    $shortMovement = $profile['id'] === 'rc_demo' && $type !== 'stationary_calibration';
    $forwardMagnitude = max(0.8, ($profile['settings']['minimum_forward_acceleration'] ?? $profile['settings']['minimum_longitudinal_acceleration']) + 0.2);
    $forwardDuration = $profile['settings']['minimum_forward_duration_ms'] > 0 ? 750 : 0;
    $forwardSamples = $forwardDuration > 0 ? 15 : 1;
    $linearRms = $type === 'forward_calibration' ? max(0.25, $forwardMagnitude * sqrt($forwardSamples / ($seconds * 20)) * 1.1) : ($shortMovement ? 0.3 : 0.1);

    return array_merge([
        'protocol_version' => 3,
        'context' => app(TelematicsCalibrationService::class)->context($booking->fresh('telematicsSetupSession.steps')->telematicsSetupSession),
        'consent' => true, 'supervised' => true,
        'started_at' => now()->utc()->subSeconds($seconds)->format('Y-m-d\TH:i:s.v\Z'),
        'ended_at' => now()->utc()->format('Y-m-d\TH:i:s.v\Z'),
        'forward_x' => 0, 'forward_y' => 0,
        'forward_z' => $type === 'forward_calibration' ? -$forwardMagnitude : 0,
        'forward_duration_ms' => $type === 'forward_calibration' ? $forwardDuration : 0,
        'forward_sample_count' => $type === 'forward_calibration' ? $forwardSamples : 0,
        'forward_coherence' => $type === 'forward_calibration' ? 1 : 0,
        'sample_count' => $seconds * 20, 'sensor_duration_ms' => $seconds * 1000 - 100,
        'linear_mean_x' => 0, 'linear_mean_y' => 0, 'linear_mean_z' => 0,
        'linear_stddev' => $linearRms,
        'horizontal_rms' => $linearRms,
        'rotation_mean_x' => 0, 'rotation_mean_y' => 0, 'rotation_mean_z' => 0,
        'rotation_rms' => 1, 'rotation_stddev' => 1,
        'max_gap_ms' => 100, 'linear_rms' => $linearRms, 'rotation_peak' => str_contains($type, 'turn_') ? ($shortMovement ? 12 : 5) : 1,
        'longitudinal_min' => $type === 'braking_calibration' ? -0.8 : 0,
        'longitudinal_max' => $type === 'forward_calibration' ? 0.8 : 0,
        'yaw_left_degrees' => $type === 'left_turn_calibration' ? 30 : 0,
        'yaw_right_degrees' => $type === 'right_turn_calibration' ? 30 : 0,
        'max_tilt_degrees' => 1,
        'gravity_x' => 0, 'gravity_y' => -9.80665, 'gravity_z' => 0,
    ], $overrides);
}

function postCalibration(Booking $booking, string $type, array $overrides = [])
{
    return test()->postJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup/steps/{$type}/attempt", [
        'evidence' => calibrationEvidence($booking, $type, $overrides),
    ]);
}

it('evaluates five ordered captures and allows only staff to release the rental', function () {
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    foreach (TelematicsCalibrationService::STEPS as $index => $type) {
        postCalibration($booking, $type)->assertOk()->assertJsonPath('data.steps.'.($index + 6).'.status', 'passed');
    }
    expect($booking->telematicsTrips()->count())->toBe(0);
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup")
        ->assertOk()->assertJsonPath('data.setup.status', 'ready_for_release')
        ->assertJsonMissing(['evidence'])->assertJsonMissing(['sample_count']);

    $started = app(BookingService::class)->transition($booking, BookingStatus::Ongoing, vehicleManagerUser());
    expect($started->telematicsSetupSession->status->value)->toBe('released');
    postCalibration($booking, 'stationary_calibration')->assertUnprocessable();
});

it('rejects skipped steps and stale context without recording an attempt', function () {
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    postCalibration($booking, 'forward_calibration')->assertUnprocessable();
    $evidence = calibrationEvidence($booking, 'stationary_calibration');
    $url = "/api/mobile/bookings/{$booking->booking_code}/telematics-setup/steps/stationary_calibration/attempt";
    $this->postJson($url, ['evidence' => $evidence])->assertOk();
    $this->postJson($url, ['evidence' => $evidence])->assertUnprocessable();
    expect($booking->fresh('telematicsSetupSession')->telematicsSetupSession->steps()->where('step_type', 'stationary_calibration')->count())->toBe(1);
});

it('rejects missing consent, supervision, invalid payloads and raw sensor streams', function (array $override, string $field) {
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    postCalibration($booking, 'stationary_calibration', $override)->assertUnprocessable()->assertJsonValidationErrors($field);
})->with([
    [['consent' => false], 'evidence.consent'],
    [['supervised' => false], 'evidence.supervised'],
    [['sample_count' => 2001], 'evidence.sample_count'],
    [['sample_count' => 1.5], 'evidence.sample_count'],
    [['longitudinal_min' => 2, 'longitudinal_max' => 1], 'evidence.longitudinal_max'],
    [['samples' => [[0, 0, 0]]], 'evidence'],
    [['status' => 'passed'], 'evidence.status'],
]);

it('records a real failed quality result and permits a fresh retry', function (array $override) {
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    postCalibration($booking, 'stationary_calibration', $override)->assertOk()->assertJsonPath('data.steps.6.status', 'failed');
    postCalibration($booking, 'stationary_calibration')->assertOk()->assertJsonPath('data.steps.6.status', 'passed')->assertJsonPath('data.steps.6.attemptCount', 2);
})->with([
    [['sample_count' => 4]], [['sensor_duration_ms' => 1000]], [['max_gap_ms' => 900]],
    [['linear_rms' => 2]], [['gravity_y' => 0, 'gravity_z' => 0]],
    [['max_tilt_degrees' => 30]],
]);

it('requires the expected direction for movement and turns', function () {
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    postCalibration($booking, 'stationary_calibration')->assertOk();
    postCalibration($booking, 'forward_calibration', ['forward_z' => -0.1])->assertOk()->assertJsonPath('data.steps.7.status', 'failed');
    postCalibration($booking, 'forward_calibration')->assertOk();
    postCalibration($booking, 'braking_calibration', ['longitudinal_min' => -0.1])->assertOk()->assertJsonPath('data.steps.8.status', 'failed');
    postCalibration($booking, 'braking_calibration')->assertOk();
    postCalibration($booking, 'left_turn_calibration', ['yaw_left_degrees' => 0, 'yaw_right_degrees' => 30])->assertOk()->assertJsonPath('data.steps.9.status', 'failed');
    postCalibration($booking, 'left_turn_calibration')->assertOk();
    postCalibration($booking, 'right_turn_calibration', ['yaw_right_degrees' => 30, 'yaw_left_degrees' => 30])->assertOk()->assertJsonPath('data.steps.10.status', 'failed');
});

it('invalidates later calibration after a new stationary reference or device attempt', function () {
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    postCalibration($booking, 'stationary_calibration')->assertOk();
    postCalibration($booking, 'forward_calibration')->assertOk();
    postCalibration($booking, 'stationary_calibration')->assertOk()->assertJsonPath('data.steps.7.status', 'pending')->assertJsonPath('data.calibration.nextStep', 'forward_calibration');
    $session = $booking->fresh('telematicsSetupSession')->telematicsSetupSession;
    app(TelematicsSetupService::class)->recordStep($session, TelematicsSetupStepType::PhoneMount, TelematicsSetupStepStatus::Passed);
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup")->assertOk()->assertJsonPath('data.steps.6.status', 'pending')->assertJsonPath('data.calibration.nextStep', 'stationary_calibration');
});

it('denies another customer calibration access', function () {
    $booking = calibrationReadyBooking();
    Sanctum::actingAs(customerUser());
    postCalibration($booking, 'stationary_calibration')->assertNotFound();
});

it('learns a horizontal forward direction for flat upright and tilted mounts', function (array $gravity, array $forward) {
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    $mount = ['gravity_x' => $gravity[0], 'gravity_y' => $gravity[1], 'gravity_z' => $gravity[2]];
    postCalibration($booking, 'stationary_calibration', $mount)->assertOk()
        ->assertJsonPath('data.steps.6.status', 'passed')
        ->assertJsonPath('data.calibration.reference.forward', null);
    postCalibration($booking, 'forward_calibration', array_merge($mount, [
        'forward_x' => $forward[0] * 3.2, 'forward_y' => $forward[1] * 3.2, 'forward_z' => $forward[2] * 3.2,
    ]))->assertOk()->assertJsonPath('data.steps.7.status', 'passed');
    $reference = app(TelematicsCalibrationService::class)->projection($booking->fresh('telematicsSetupSession.steps')->telematicsSetupSession)['reference'];
    foreach ($forward as $axis => $value) {
        expect(abs($reference['forward'][$axis] - $value))->toBeLessThan(0.00001);
    }
    foreach (array_slice(TelematicsCalibrationService::STEPS, 2) as $index => $type) {
        postCalibration($booking, $type, $mount)->assertOk()->assertJsonPath('data.steps.'.($index + 8).'.status', 'passed');
    }
})->with([
    [[0, 0, -9.80665], [0, 1, 0]],
    [[0, 0, 9.80665], [-1, 0, 0]],
    [[0, -9.80665, 0], [0, 0, -1]],
    [[0, -6.93435, -6.93435], [0, sqrt(0.5), -sqrt(0.5)]],
    [[-9.80665, 0, 0], [0, 1, 0]],
]);

it('retains a single qualifying Forward sample despite lower acceleration over the recording', function (string $profile, float $peak) {
    config(['telematics.calibration_profile' => $profile]);
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    postCalibration($booking, 'stationary_calibration')->assertOk()->assertJsonPath('data.steps.6.status', 'passed')
        ->assertJsonPath('data.calibration.forwardLimits.acceleration', 3)
        ->assertJsonPath('data.calibration.forwardLimits.durationMs', 0)
        ->assertJsonPath('data.calibration.forwardLimits.samples', 1);
    $rms = $peak / sqrt(20);
    postCalibration($booking, 'forward_calibration', [
        'started_at' => now()->utc()->subMilliseconds(1000)->format('Y-m-d\TH:i:s.v\Z'),
        'sample_count' => 20, 'sensor_duration_ms' => 950,
        'forward_z' => -$peak, 'forward_sample_count' => 1, 'forward_duration_ms' => 0,
        'linear_mean_z' => -$peak / 20, 'linear_rms' => $rms, 'horizontal_rms' => $rms,
        'linear_stddev' => sqrt($rms ** 2 - ($peak / 20) ** 2),
        'rotation_peak' => 55.51, 'longitudinal_min' => 0, 'longitudinal_max' => 0,
    ])->assertOk()->assertJsonPath('data.steps.7.status', $peak >= 3 ? 'passed' : 'failed');
})->with(['standard', 'rc_demo'])->with([2.99, 3.0, 3.02]);

it('honors configured sustained straight consistent horizontal movement limits', function (array $override) {
    config(['telematics.calibration.minimum_forward_duration_ms' => 500, 'telematics.calibration.minimum_forward_samples' => 5]);
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    postCalibration($booking, 'stationary_calibration')->assertOk();
    postCalibration($booking, 'forward_calibration', $override)->assertOk()
        ->assertJsonPath('data.steps.7.status', 'failed')
        ->assertJsonPath('data.calibration.reference.forward', null);
})->with([
    [['forward_duration_ms' => 100]],
    [['forward_sample_count' => 1]],
    [['forward_coherence' => 0.4]],
    [['forward_z' => 0, 'forward_y' => -0.8]],
    [['yaw_left_degrees' => 181]],
    [['rotation_peak' => 61]],
    [['forward_z' => -10]],
]);

it('detects a changed flat mount and permits a fresh forward retry', function () {
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    postCalibration($booking, 'stationary_calibration', ['gravity_y' => 0, 'gravity_z' => -9.80665])->assertOk();
    postCalibration($booking, 'forward_calibration')->assertOk()->assertJsonPath('data.steps.7.status', 'failed');
    postCalibration($booking, 'forward_calibration', ['gravity_y' => 0, 'gravity_z' => -9.80665, 'forward_y' => 3.2, 'forward_z' => 0])
        ->assertOk()->assertJsonPath('data.steps.7.status', 'passed');
});

it('restarts an unfinished legacy calibration without deleting its attempts', function (int $legacyProtocol) {
    $booking = calibrationReadyBooking();
    $session = $booking->fresh('telematicsSetupSession')->telematicsSetupSession;
    app(TelematicsSetupService::class)->recordStep($session, TelematicsSetupStepType::StationaryCalibration, TelematicsSetupStepStatus::Passed, [
        'protocol_version' => $legacyProtocol, 'mount_reference' => ['down' => [0, -1, 0], 'forward' => [0, 0, -1]],
    ]);
    Sanctum::actingAs($booking->user);
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup")->assertOk()
        ->assertJsonPath('data.calibration.protocolVersion', 3)
        ->assertJsonPath('data.calibration.nextStep', 'stationary_calibration')
        ->assertJsonPath('data.calibration.reference', null);
    expect($session->steps()->where('step_type', 'stationary_calibration')->count())->toBe(1);
    postCalibration($booking, 'stationary_calibration')->assertOk()->assertJsonPath('data.steps.6.attemptCount', 2);
    postCalibration($booking, 'forward_calibration', ['protocol_version' => $legacyProtocol])->assertUnprocessable();
})->with([1, 2]);

it('preserves completed legacy readiness and released history', function (int $legacyProtocol) {
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    foreach (TelematicsCalibrationService::STEPS as $type) {
        postCalibration($booking, $type)->assertOk();
    }
    $session = $booking->fresh('telematicsSetupSession.steps')->telematicsSetupSession;
    foreach ($session->steps as $step) {
        if (in_array($step->step_type->value, TelematicsCalibrationService::STEPS, true)) {
            $evidence = $step->evidence;
            $evidence['protocol_version'] = $legacyProtocol;
            $step->update(['evidence' => $evidence]);
        }
    }
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup")->assertOk()
        ->assertJsonPath('data.setup.status', 'ready_for_release')
        ->assertJsonPath('data.calibration.nextStep', null);
    app(BookingService::class)->transition($booking->fresh(), BookingStatus::Ongoing, vehicleManagerUser());
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup")->assertOk()
        ->assertJsonPath('data.setup.status', 'released')
        ->assertJsonPath('data.steps.6.status', 'passed');
    expect($session->steps()->where('step_type', 'stationary_calibration')->count())->toBe(1);
})->with([1, 2]);

it('projects configured stationary limits for live guidance without exposing capture evidence', function () {
    config(['telematics.calibration.stationary_linear_rms' => 0.28, 'telematics.calibration.stationary_rotation_peak' => 4]);
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup")->assertOk()
        ->assertJsonPath('data.calibration.stationaryLimits.linearRms', 0.28)
        ->assertJsonPath('data.calibration.stationaryLimits.rotationPeak', 4)
        ->assertJsonPath('data.calibration.stationaryLimits.maxGapMs', 500)
        ->assertJsonMissing(['evidence'])->assertJsonMissing(['sample_count']);
});

it('projects configured forward guidance limits without exposing raw evidence', function () {
    config([
        'telematics.calibration.minimum_forward_acceleration' => 0.65,
        'telematics.calibration.minimum_forward_duration_ms' => 600,
        'telematics.calibration.minimum_forward_samples' => 5,
        'telematics.calibration.minimum_forward_coherence' => 0.95,
    ]);
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup")->assertOk()
        ->assertJsonPath('data.calibration.forwardLimits.acceleration', 0.65)
        ->assertJsonPath('data.calibration.forwardLimits.durationMs', 600)
        ->assertJsonPath('data.calibration.forwardLimits.coherence', 0.95)
        ->assertJsonPath('data.calibration.forwardLimits.samples', 5)
        ->assertJsonPath('data.calibration.movementLimits.rotationPeak', 60)
        ->assertJsonPath('data.calibration.movementLimits.yawDegrees', 180)
        ->assertJsonMissing(['evidence'])->assertJsonMissing(['sample_count']);
    postCalibration($booking, 'stationary_calibration')->assertOk()->assertJsonPath('data.steps.6.status', 'passed');
    postCalibration($booking, 'forward_calibration', ['rotation_peak' => 55.51])
        ->assertOk()->assertJsonPath('data.steps.7.status', 'passed');
});

it('uses accepted parked noise to raise the forward minimum without lowering the configured floor', function () {
    config(['telematics.calibration.minimum_forward_acceleration' => 0.5]);
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    postCalibration($booking, 'stationary_calibration', [
        'linear_rms' => 0.3, 'linear_stddev' => 0.3, 'horizontal_rms' => 0.3,
    ])->assertOk()->assertJsonPath('data.steps.6.status', 'passed')
        ->assertJsonPath('data.calibration.noiseBaseline.horizontalRms', 0.3);
    $projected = $this->getJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup")->assertOk();
    expect($projected->json('data.calibration.forwardLimits.acceleration'))->toEqualWithDelta(0.9, 0.00001);
    postCalibration($booking, 'forward_calibration')->assertOk()->assertJsonPath('data.steps.7.status', 'failed');
    postCalibration($booking, 'forward_calibration', [
        'forward_z' => -1.1, 'linear_rms' => 0.3, 'linear_stddev' => 0.3, 'horizontal_rms' => 0.3,
    ])->assertOk()->assertJsonPath('data.steps.7.status', 'passed')
        ->assertJsonPath('data.calibration.noiseBaseline.horizontalRms', 0.3);
    postCalibration($booking, 'stationary_calibration')->assertOk()
        ->assertJsonPath('data.calibration.forwardLimits.acceleration', 0.5)
        ->assertJsonPath('data.calibration.noiseBaseline.horizontalRms', 0.1)
        ->assertJsonPath('data.calibration.nextStep', 'forward_calibration')
        ->assertJsonPath('data.steps.7.status', 'pending');
});

it('never turns an unstable or mathematically inconsistent baseline into a relaxed setup', function (array $override) {
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    postCalibration($booking, 'stationary_calibration', $override)->assertOk()
        ->assertJsonPath('data.steps.6.status', 'failed')
        ->assertJsonPath('data.calibration.noiseBaseline', null)
        ->assertJsonPath('data.calibration.forwardLimits.acceleration', 3)
        ->assertJsonPath('data.calibration.nextStep', 'stationary_calibration');
})->with([
    [['linear_rms' => 0.36, 'linear_stddev' => 0.36, 'horizontal_rms' => 0.36]],
    [['rotation_peak' => 7, 'rotation_rms' => 3, 'rotation_stddev' => 3]],
    [['max_tilt_degrees' => 11]],
    [['max_gap_ms' => 501]],
    [['horizontal_rms' => 0.2]],
    [['linear_stddev' => 0]],
    [['rotation_stddev' => 0]],
    [['rotation_rms' => 2, 'rotation_stddev' => 2]],
]);

it('requires the new bounded statistics and rejects a client-chosen baseline', function (array $override, string $field) {
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    postCalibration($booking, 'stationary_calibration', $override)->assertUnprocessable()->assertJsonValidationErrors($field);
})->with([
    [['protocol_version' => 2], 'evidence.protocol_version'],
    [['horizontal_rms' => null], 'evidence.horizontal_rms'],
    [['rotation_stddev' => -1], 'evidence.rotation_stddev'],
    [['linear_mean_x' => 101], 'evidence.linear_mean_x'],
    [['noise_baseline' => ['horizontalRms' => 0]], 'evidence'],
]);

it('invalidates the noise profile when a device prerequisite is repeated without deleting history', function () {
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    postCalibration($booking, 'stationary_calibration')->assertOk();
    $session = $booking->fresh('telematicsSetupSession')->telematicsSetupSession;
    app(TelematicsSetupService::class)->recordStep($session, TelematicsSetupStepType::DeviceCheck, TelematicsSetupStepStatus::Passed);
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup")->assertOk()
        ->assertJsonPath('data.calibration.noiseBaseline', null)
        ->assertJsonPath('data.calibration.forwardLimits.acceleration', 3)
        ->assertJsonPath('data.calibration.nextStep', 'stationary_calibration');
    expect($session->steps()->where('step_type', 'stationary_calibration')->count())->toBe(1);
});

it('keeps Stationary unchanged and stamps the RC demonstration profile on every outcome', function () {
    config(['telematics.calibration_profile' => 'rc_demo']);
    $profile = app(TelematicsCalibrationProfileService::class)->active();
    expect($profile['id'])->toBe('rc_demo')->and($profile['revision'])->toBe(5)
        ->and($profile['settings']['capture_seconds']['stationary_calibration'])->toBe(6)
        ->and($profile['settings']['stationary_rotation_peak'])->toBe(6)
        ->and($profile['settings']['maximum_tilt_degrees'])->toBe(10)
        ->and($profile['settings']['capture_seconds']['forward_calibration'])->toBe(3)
        ->and($profile['settings']['minimum_forward_acceleration'])->toBe(3)
        ->and($profile['settings']['forward_acceleration_only'])->toBeTrue();
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    postCalibration($booking, 'stationary_calibration', ['max_gap_ms' => 501])->assertOk()
        ->assertJsonPath('data.steps.6.status', 'failed')
        ->assertJsonPath('data.calibration.profile.id', 'rc_demo')
        ->assertJsonMissing(['calibration_profile'])->assertJsonMissing(['settings']);
    postCalibration($booking, 'stationary_calibration')->assertOk()->assertJsonPath('data.steps.6.status', 'passed');
    $attempts = $booking->fresh('telematicsSetupSession.steps')->telematicsSetupSession->steps->where('step_type', TelematicsSetupStepType::StationaryCalibration);
    foreach ($attempts as $attempt) {
        expect($attempt->evidence['calibration_profile'])->toBe($profile)
            ->and($attempt->evidence)->not->toHaveKey('context');
    }
});

it('ignores RC selection and overrides outside local or testing', function (string $environment) {
    $this->app->detectEnvironment(fn () => $environment);
    config(['telematics.calibration_profile' => 'rc_demo', 'telematics.calibration_rc_overrides.maximum_tilt_degrees' => 40]);
    $profile = app(TelematicsCalibrationProfileService::class)->active();
    expect($profile['id'])->toBe('standard')->and($profile['settings']['maximum_tilt_degrees'])->toBe(10);
})->with(['production', 'staging']);

it('permits RC selection only in explicitly supported development environments', function (string $environment) {
    $this->app->detectEnvironment(fn () => $environment);
    config(['telematics.calibration_profile' => 'rc_demo']);
    expect(app(TelematicsCalibrationProfileService::class)->active()['id'])->toBe('rc_demo');
})->with(['local', 'testing']);

it('uses RC overrides only for RC evaluation and live limits', function () {
    config(['telematics.calibration_profile' => 'rc_demo', 'telematics.calibration_rc_overrides.stationary_linear_rms' => 0.2]);
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    postCalibration($booking, 'stationary_calibration', ['linear_rms' => 0.25, 'linear_stddev' => 0.25, 'horizontal_rms' => 0.25])
        ->assertOk()->assertJsonPath('data.calibration.stationaryLimits.linearRms', 0.2)
        ->assertJsonPath('data.steps.6.status', 'failed');
    config(['telematics.calibration_profile' => 'standard']);
    postCalibration($booking, 'stationary_calibration', ['linear_rms' => 0.25, 'linear_stddev' => 0.25, 'horizontal_rms' => 0.25])
        ->assertOk()->assertJsonPath('data.calibration.stationaryLimits.linearRms', 0.35)
        ->assertJsonPath('data.steps.6.status', 'passed');
});

it('rejects client-selected profile metadata', function () {
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    postCalibration($booking, 'stationary_calibration', ['calibration_profile' => ['id' => 'rc_demo']])
        ->assertUnprocessable()->assertJsonValidationErrors('evidence');
    expect($booking->fresh('telematicsSetupSession')->telematicsSetupSession->steps()->where('step_type', 'stationary_calibration')->count())->toBe(0);
});

it('invalidates old context baseline and progress when profile settings change', function () {
    config(['telematics.calibration_profile' => 'rc_demo']);
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    postCalibration($booking, 'stationary_calibration')->assertOk();
    postCalibration($booking, 'forward_calibration')->assertOk();
    $evidence = calibrationEvidence($booking, 'braking_calibration');
    config(['telematics.calibration_rc_overrides.stationary_rotation_peak' => 5]);
    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup/steps/braking_calibration/attempt", ['evidence' => $evidence])
        ->assertUnprocessable()->assertJsonValidationErrors('step');
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup")->assertOk()
        ->assertJsonPath('data.calibration.nextStep', 'stationary_calibration')
        ->assertJsonPath('data.calibration.noiseBaseline', null)->assertJsonPath('data.calibration.reference', null)
        ->assertJsonPath('data.steps.6.status', 'pending')->assertJsonPath('data.steps.7.status', 'pending');
    expect($booking->fresh('telematicsSetupSession')->telematicsSetupSession->steps()->where('step_type', 'braking_calibration')->count())->toBe(0);
    postCalibration($booking, 'stationary_calibration')->assertOk()->assertJsonPath('data.steps.6.attemptCount', 2);
});

it('requires fresh calibration before RC readiness can be used under standard rules', function (bool $production) {
    config(['telematics.calibration_profile' => 'rc_demo']);
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    foreach (TelematicsCalibrationService::STEPS as $type) {
        postCalibration($booking, $type)->assertOk();
    }
    expect(app(TelematicsSetupService::class)->isReady($booking->fresh('telematicsSetupSession.steps')->telematicsSetupSession))->toBeTrue();
    if ($production) {
        $this->app->detectEnvironment(fn () => 'production');
    } else {
        config(['telematics.calibration_profile' => 'standard']);
    }
    expect(fn () => app(TelematicsSetupService::class)->assertReadyForRelease($booking->fresh('telematicsSetupSession.steps')))
        ->toThrow(ValidationException::class);
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup")->assertOk()
        ->assertJsonPath('data.setup.status', 'in_progress')->assertJsonPath('data.setup.readyAt', null)
        ->assertJsonPath('data.eligibility.canWorkSetup', true)
        ->assertJsonPath('data.calibration.profile.id', 'standard')
        ->assertJsonPath('data.calibration.nextStep', 'stationary_calibration');
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}")->assertOk()
        ->assertJsonPath('data.telematicsSetupStatus', 'in_progress');
    postCalibration($booking, 'stationary_calibration')->assertOk()
        ->assertJsonPath('data.steps.6.status', 'passed')->assertJsonPath('data.steps.6.attemptCount', 2)
        ->assertJsonPath('data.steps.7.status', 'pending');
})->with([false, true]);

it('preserves the recorded RC profile and timestamps after staff release', function () {
    config(['telematics.calibration_profile' => 'rc_demo']);
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    foreach (TelematicsCalibrationService::STEPS as $type) {
        postCalibration($booking, $type)->assertOk();
    }
    app(BookingService::class)->transition($booking->fresh(), BookingStatus::Ongoing, vehicleManagerUser());
    config(['telematics.calibration_profile' => 'standard']);
    $response = $this->getJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup")->assertOk()
        ->assertJsonPath('data.setup.status', 'released')
        ->assertJsonPath('data.calibration.profile.id', 'rc_demo')
        ->assertJsonPath('data.steps.6.status', 'passed');
    expect($response->json('data.setup.readyAt'))->not->toBeNull();
});

it('accepts a three-second RC movement sequence with generous vibration limits but real movement evidence', function () {
    config(['telematics.calibration_profile' => 'rc_demo']);
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    postCalibration($booking, 'stationary_calibration')->assertOk()->assertJsonPath('data.steps.6.status', 'passed');
    foreach (array_slice(TelematicsCalibrationService::STEPS, 1) as $index => $type) {
        postCalibration($booking, $type, [
            'rotation_peak' => $type === 'forward_calibration' ? 170 : 70,
            'rotation_rms' => $type === 'forward_calibration' ? 80 : 20,
            'rotation_stddev' => $type === 'forward_calibration' ? 80 : 20,
            'max_tilt_degrees' => 35,
        ])->assertOk()->assertJsonPath('data.steps.'.($index + 7).'.status', 'passed')
            ->assertJsonPath('data.calibration.captureSeconds.'.$type, 3)
            ->assertJsonPath('data.calibration.profile.revision', 5)
            ->assertJsonPath('data.calibration.forwardLimits.acceleration', 3)
            ->assertJsonPath('data.calibration.movementLimits.forwardAccelerationOnly', true)
            ->assertJsonPath('data.calibration.forwardLimits.acceleration', 3)
            ->assertJsonPath('data.calibration.movementLimits.rotationPeak', 120)
            ->assertJsonPath('data.calibration.stationaryLimits.rotationPeak', 6);
    }
    expect($booking->fresh('telematicsSetupSession')->telematicsSetupSession->status->value)->toBe('ready_for_release');
    expect($booking->telematicsTrips()->count())->toBe(0);
});

it('does not relax RC Stationary quality or standard movement limits', function () {
    config(['telematics.calibration_profile' => 'rc_demo']);
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    postCalibration($booking, 'stationary_calibration', ['rotation_peak' => 70, 'max_tilt_degrees' => 35])
        ->assertOk()->assertJsonPath('data.steps.6.status', 'failed');
    config(['telematics.calibration_profile' => 'standard']);
    postCalibration($booking, 'stationary_calibration')->assertOk()->assertJsonPath('data.steps.6.status', 'passed');
    postCalibration($booking, 'forward_calibration', ['rotation_peak' => 70, 'max_tilt_degrees' => 35])
        ->assertOk()->assertJsonPath('data.steps.7.status', 'failed')
        ->assertJsonPath('data.calibration.captureSeconds.forward_calibration', 12)
        ->assertJsonPath('data.calibration.movementLimits.rotationPeak', 60)
        ->assertJsonPath('data.calibration.movementLimits.tiltDegrees', 10);
});

it('rejects missing RC movement evidence rather than passing because three seconds elapsed', function (string $type, array $override) {
    config(['telematics.calibration_profile' => 'rc_demo']);
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    foreach (TelematicsCalibrationService::STEPS as $index => $current) {
        if ($current === $type) {
            postCalibration($booking, $type, $override)->assertOk()
                ->assertJsonPath('data.steps.'.($index + 6).'.status', 'failed')
                ->assertJsonPath('data.calibration.nextStep', $type);
            break;
        }
        postCalibration($booking, $current)->assertOk()->assertJsonPath('data.steps.'.($index + 6).'.status', 'passed');
    }
})->with([
    ['forward_calibration', ['forward_x' => 0, 'forward_y' => 0, 'forward_z' => 0, 'forward_duration_ms' => 0, 'forward_sample_count' => 0, 'forward_coherence' => 0]],
    ['braking_calibration', ['longitudinal_min' => 0, 'longitudinal_max' => 0.8]],
    ['left_turn_calibration', ['yaw_left_degrees' => 0, 'yaw_right_degrees' => 30]],
    ['right_turn_calibration', ['yaw_right_degrees' => 0, 'yaw_left_degrees' => 30]],
    ['left_turn_calibration', ['yaw_left_degrees' => 20, 'yaw_right_degrees' => 18, 'rotation_peak' => 20]],
    ['right_turn_calibration', ['yaw_right_degrees' => 20, 'yaw_left_degrees' => 18, 'rotation_peak' => 20]],
]);

it('retains RC sensor integrity and extreme-position checks', function (array $override) {
    config(['telematics.calibration_profile' => 'rc_demo']);
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    postCalibration($booking, 'stationary_calibration')->assertOk();
    postCalibration($booking, 'forward_calibration', $override)->assertOk()->assertJsonPath('data.steps.7.status', 'failed');
})->with([
    [['max_gap_ms' => 501]], [['sample_count' => 10]], [['sensor_duration_ms' => 1000]],
    [['max_tilt_degrees' => 61]],
]);

it('accepts early movement completion while retaining the full Stationary measurement', function (string $profile) {
    config(['telematics.calibration_profile' => $profile]);
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    postCalibration($booking, 'stationary_calibration', [
        'started_at' => now()->utc()->subMilliseconds(1500)->format('Y-m-d\TH:i:s.v\Z'),
        'sample_count' => 30, 'sensor_duration_ms' => 1450,
    ])->assertOk()->assertJsonPath('data.steps.6.status', 'failed');
    postCalibration($booking, 'stationary_calibration')->assertOk()->assertJsonPath('data.steps.6.status', 'passed');
    foreach (array_slice(TelematicsCalibrationService::STEPS, 1) as $index => $type) {
        $turn = str_contains($type, 'turn_');
        postCalibration($booking, $type, [
            'started_at' => now()->utc()->subMilliseconds(1500)->format('Y-m-d\TH:i:s.v\Z'),
            'sample_count' => 30, 'sensor_duration_ms' => 1450,
            'linear_rms' => $profile === 'rc_demo' && $type === 'forward_calibration' ? 1.1 : 0.8,
            'linear_stddev' => $profile === 'rc_demo' && $type === 'forward_calibration' ? 1.1 : 0.8,
            'horizontal_rms' => $profile === 'rc_demo' && $type === 'forward_calibration' ? 1.1 : 0.8,
            'rotation_peak' => $turn ? 30 : 1,
            'rotation_rms' => $turn ? 10 : 1, 'rotation_stddev' => $turn ? 10 : 1,
        ])->assertOk()->assertJsonPath('data.steps.'.($index + 7).'.status', 'passed')
            ->assertJsonPath('data.calibration.completionLimits.minimumDurationMs', 1000);
    }
    expect($booking->fresh('telematicsSetupSession')->telematicsSetupSession->status->value)->toBe('ready_for_release');
    expect($booking->telematicsTrips()->count())->toBe(0);
})->with(['standard', 'rc_demo']);

it('rejects early captures with inadequate or incorrect motion evidence', function (array $override) {
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    postCalibration($booking, 'stationary_calibration')->assertOk();
    postCalibration($booking, 'forward_calibration', array_merge([
        'started_at' => now()->utc()->subMilliseconds(1500)->format('Y-m-d\TH:i:s.v\Z'),
        'sample_count' => 30, 'sensor_duration_ms' => 1450,
        'linear_rms' => 0.8, 'linear_stddev' => 0.8, 'horizontal_rms' => 0.8,
    ], $override))->assertOk()->assertJsonPath('data.steps.7.status', 'failed')
        ->assertJsonPath('data.calibration.nextStep', 'forward_calibration');
})->with([
    [['sample_count' => 7]], [['sensor_duration_ms' => 1100]], [['max_gap_ms' => 501]],
    [['forward_z' => 0]], [['forward_coherence' => 0.5]], [['rotation_peak' => 61]], [['max_tilt_degrees' => 11]],
]);

it('rejects a fresh movement shorter than the minimum observation interval', function () {
    $booking = calibrationReadyBooking();
    Sanctum::actingAs($booking->user);
    postCalibration($booking, 'stationary_calibration')->assertOk();
    postCalibration($booking, 'forward_calibration', [
        'started_at' => now()->utc()->subMilliseconds(900)->format('Y-m-d\TH:i:s.v\Z'),
        'sample_count' => 18, 'sensor_duration_ms' => 850,
        'linear_rms' => 0.8, 'linear_stddev' => 0.8, 'horizontal_rms' => 0.8,
    ])->assertOk()->assertJsonPath('data.steps.7.status', 'failed')
        ->assertJsonPath('data.steps.7.failureReason', 'The recording was interrupted. Repeat this step.');
});
