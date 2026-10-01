<?php

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Enums\TelematicsSetupStatus;
use App\Enums\TelematicsSetupStepStatus;
use App\Enums\TelematicsSetupStepType;
use App\Models\Booking;
use App\Models\Geofence;
use App\Services\BookingService;
use App\Services\CircularGeofenceService;
use App\Services\TelematicsSetupService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Storage::fake('local');
});

function attemptBooking(): Booking
{
    $booking = telematicsFoundationBooking();
    finalizeFoundationOutgoing($booking);
    app(TelematicsSetupService::class)->assignGeofenceSnapshot($booking, null, [
        'name' => 'Attempt boundary', 'center_latitude' => 14.299, 'center_longitude' => 120.958, 'radius_meters' => 1000,
    ], vehicleManagerUser());
    app(TelematicsSetupService::class)->startHandover($booking, vehicleManagerUser());

    return $booking->fresh(['user', 'telematicsSetupSession.steps', 'bookingGeofence']);
}

function passAttemptPrerequisites(Booking $booking, array $types): void
{
    $service = app(TelematicsSetupService::class);
    $session = $booking->fresh('telematicsSetupSession')->telematicsSetupSession;
    foreach ($types as $type) {
        $service->recordStep($session, $type, TelematicsSetupStepStatus::Passed);
        $session->refresh();
    }
}

function setupAttemptPayload(array $overrides = []): array
{
    return array_merge([
        'latitude' => 14.299, 'longitude' => 120.958, 'accuracy' => 10, 'captured_at' => now()->toISOString(), 'location_services_enabled' => true,
    ], $overrides);
}

it('requires an in-progress session and rejects client-selected statuses', function () {
    $booking = telematicsFoundationBooking();
    finalizeFoundationOutgoing($booking);
    Sanctum::actingAs($booking->user);

    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup/steps/device_check/attempt", [
        'status' => 'passed',
        'evidence' => [],
    ])->assertUnprocessable();

    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup/steps/device_check/attempt", [
        'evidence' => ['accelerometer_available' => true, 'gyroscope_available' => true, 'location_services_available' => true, 'platform' => 'android', 'build_context' => 'standalone', 'checked_at' => now()->toISOString()],
    ])->assertUnprocessable();
});

it('validates device and permission evidence and preserves failed retries', function () {
    $booking = attemptBooking();
    Sanctum::actingAs($booking->user);
    $url = "/api/mobile/bookings/{$booking->booking_code}/telematics-setup/steps";

    $this->postJson("{$url}/device_check/attempt", ['evidence' => ['accelerometer_available' => false, 'gyroscope_available' => true, 'location_services_available' => true, 'platform' => 'android', 'build_context' => 'standalone', 'checked_at' => now()->toISOString()]])
        ->assertOk()->assertJsonPath('data.steps.0.status', 'failed');
    $this->postJson("{$url}/device_check/attempt", ['evidence' => ['accelerometer_available' => true, 'gyroscope_available' => true, 'location_services_available' => true, 'platform' => 'android', 'build_context' => 'standalone', 'checked_at' => now()->toISOString()]])
        ->assertOk()->assertJsonPath('data.steps.0.status', 'passed')->assertJsonPath('data.steps.0.attemptCount', 2);
    $this->postJson("{$url}/motion_permission/attempt", ['evidence' => ['permission_state' => 'denied', 'platform' => 'android', 'checked_at' => now()->toISOString()]])
        ->assertOk()->assertJsonPath('data.steps.1.status', 'failed');
});

it('rejects another renter and owner-driver access', function () {
    $booking = attemptBooking();
    Sanctum::actingAs(customerUser());
    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup/steps/device_check/attempt", ['evidence' => [
        'accelerometer_available' => true,
        'gyroscope_available' => true,
        'location_services_available' => true,
        'platform' => 'android',
        'build_context' => 'standalone',
        'checked_at' => now()->toISOString(),
    ]])->assertNotFound();

    $ownerDriver = telematicsFoundationBooking(RentalType::OwnersDriver);
    Sanctum::actingAs($ownerDriver->user);
    $this->getJson("/api/mobile/bookings/{$ownerDriver->booking_code}/telematics-setup")->assertNotFound();
});

it('treats a GPS point on the circular geofence radius as inside', function () {
    $booking = attemptBooking();
    $geofence = $booking->bookingGeofence;
    $radius = (float) $geofence->radius_meters;
    $earthRadius = 6371008.8;
    $latitudeAtBoundary = (float) $geofence->center_latitude + rad2deg($radius / $earthRadius);

    $result = app(CircularGeofenceService::class)->evaluate(
        $geofence,
        $latitudeAtBoundary,
        (float) $geofence->center_longitude,
    );

    expect($result['distance_meters'])->toBeGreaterThanOrEqual($radius - 0.01)
        ->and($result['distance_meters'])->toBeLessThanOrEqual($radius + 0.01)
        ->and($result['inside'])->toBeTrue();
});

it('validates fresh GPS quality and uses the immutable booking geofence server-side', function () {
    $booking = attemptBooking();
    passAttemptPrerequisites($booking, [TelematicsSetupStepType::DeviceCheck, TelematicsSetupStepType::MotionPermission, TelematicsSetupStepType::LocationPermission, TelematicsSetupStepType::BackgroundLocation]);
    Sanctum::actingAs($booking->user);
    $url = "/api/mobile/bookings/{$booking->booking_code}/telematics-setup/steps/gps_check/attempt";

    $this->postJson($url, ['evidence' => setupAttemptPayload(['latitude' => 91])])->assertUnprocessable();
    $this->postJson($url, ['evidence' => setupAttemptPayload(['captured_at' => now()->subMinutes(2)->toISOString()])])->assertOk()->assertJsonPath('data.steps.4.status', 'failed');
    $this->postJson($url, ['evidence' => setupAttemptPayload(['accuracy' => 100])])->assertOk()->assertJsonPath('data.steps.4.status', 'failed');
    $this->postJson($url, ['evidence' => setupAttemptPayload()])->assertOk()->assertJsonPath('data.steps.4.status', 'passed');

    $geofenceUrl = "/api/mobile/bookings/{$booking->booking_code}/telematics-setup/steps/geofence_check/attempt";
    $this->postJson($geofenceUrl, ['evidence' => setupAttemptPayload()])->assertOk()->assertJsonPath('data.geofenceCheck.inside', true);
    $this->postJson($geofenceUrl, ['evidence' => setupAttemptPayload(['latitude' => 14.35, 'longitude' => 121.05])])->assertOk()->assertJsonPath('data.geofenceCheck.inside', false);

    expect($booking->fresh('telematicsSetupSession')->telematicsSetupSession->status)->toBe(TelematicsSetupStatus::InProgress);
    expect($booking->telematicsTrips()->count())->toBe(0);

    Sanctum::actingAs($booking->user);
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup")
        ->assertOk()
        ->assertJsonMissing(['latitude'])
        ->assertJsonMissing(['longitude'])
        ->assertJsonMissing(['evidence']);
});

it('does not use a changed source template and requires geofence readiness before manual phone mount', function () {
    $template = Geofence::factory()->create(['center_latitude' => 14.299, 'center_longitude' => 120.958, 'radius_meters' => 1000]);
    $booking = telematicsFoundationBooking();
    finalizeFoundationOutgoing($booking);
    app(TelematicsSetupService::class)->assignGeofenceSnapshot($booking, $template, [], vehicleManagerUser());
    app(TelematicsSetupService::class)->startHandover($booking, vehicleManagerUser());
    $template->update(['center_latitude' => 0, 'center_longitude' => 0, 'radius_meters' => 5]);
    passAttemptPrerequisites($booking, [TelematicsSetupStepType::DeviceCheck, TelematicsSetupStepType::MotionPermission, TelematicsSetupStepType::LocationPermission, TelematicsSetupStepType::BackgroundLocation, TelematicsSetupStepType::GpsCheck]);
    Sanctum::actingAs($booking->user);

    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup/steps/geofence_check/attempt", ['evidence' => setupAttemptPayload()])
        ->assertOk()->assertJsonPath('data.geofenceCheck.inside', true);
    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup/steps/phone_mount/attempt", ['evidence' => ['confirmed' => true, 'checked_at' => now()->toISOString()]])
        ->assertOk()->assertJsonPath('data.steps.6.status', 'passed');

    expect($booking->fresh('telematicsSetupSession')->telematicsSetupSession->status)->toBe(TelematicsSetupStatus::InProgress);
});

it('keeps released setup read-only after staff starts the rental', function () {
    $booking = attemptBooking();
    $service = app(TelematicsSetupService::class);
    $session = $booking->fresh('telematicsSetupSession')->telematicsSetupSession;

    foreach (TelematicsSetupService::requiredSteps() as $type) {
        $service->recordStep($session, $type, TelematicsSetupStepStatus::Passed);
        $session->refresh();
    }

    expect($session->status)->toBe(TelematicsSetupStatus::ReadyForRelease);

    $started = app(BookingService::class)->transition($booking, BookingStatus::Ongoing, vehicleManagerUser());
    $releasedSession = $started->fresh('telematicsSetupSession')->telematicsSetupSession;
    $attemptCount = $releasedSession->steps()->count();

    expect($started->status)->toBe(BookingStatus::Ongoing)
        ->and($releasedSession->status)->toBe(TelematicsSetupStatus::Released);

    Sanctum::actingAs($booking->user);
    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup/steps/device_check/attempt", ['evidence' => [
        'accelerometer_available' => true,
        'gyroscope_available' => true,
        'location_services_available' => true,
        'platform' => 'android',
        'build_context' => 'standalone',
        'checked_at' => now()->toISOString(),
    ]])->assertUnprocessable();

    expect($releasedSession->steps()->count())->toBe($attemptCount);

    $this->getJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup")
        ->assertOk()
        ->assertJsonPath('data.bookingStatus', 'ongoing')
        ->assertJsonPath('data.setup.status', 'released');
});
