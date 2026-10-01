<?php

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Enums\TelematicsSetupStatus;
use App\Enums\TelematicsSetupStepStatus;
use App\Enums\TelematicsSetupStepType;
use App\Models\Booking;
use App\Services\BookingService;
use App\Services\TelematicsSetupService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Spatie\Activitylog\Models\Activity;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Storage::fake('local');
});

function handoverBooking(RentalType $type = RentalType::SelfDrive): Booking
{
    return telematicsFoundationBooking($type);
}

function handoverSnapshot(Booking $booking): void
{
    app(TelematicsSetupService::class)->assignGeofenceSnapshot($booking, null, [
        'name' => 'Handover service area',
        'center_latitude' => 14.299,
        'center_longitude' => 120.958,
        'radius_meters' => 3000,
    ], vehicleManagerUser());
}

it('rejects staff handover for non-self-drive bookings', function () {
    $booking = handoverBooking(RentalType::OwnersDriver);

    expect(fn () => app(TelematicsSetupService::class)->startHandover($booking, vehicleManagerUser()))
        ->toThrow(ValidationException::class);
});

it('rejects handover before finalized outgoing signatures and an assigned snapshot', function () {
    $booking = handoverBooking();
    handoverSnapshot($booking);

    expect(fn () => app(TelematicsSetupService::class)->startHandover($booking, vehicleManagerUser()))
        ->toThrow(ValidationException::class);

    finalizeFoundationOutgoing($booking);
    $session = $booking->fresh('telematicsSetupSession')->telematicsSetupSession;
    expect($session->status)->toBe(TelematicsSetupStatus::SetupRequired);

    $withoutGeofence = handoverBooking();
    finalizeFoundationOutgoing($withoutGeofence);
    expect(fn () => app(TelematicsSetupService::class)->startHandover($withoutGeofence, vehicleManagerUser()))
        ->toThrow(ValidationException::class);
});

it('starts the eligible handover through the authorized staff endpoint and records activity', function () {
    $booking = handoverBooking();
    finalizeFoundationOutgoing($booking);
    handoverSnapshot($booking);
    $manager = vehicleManagerUser();

    $this->actingAs($manager)
        ->postJson("/admin/bookings/{$booking->id}/telematics-setup/start")
        ->assertOk()
        ->assertJsonPath('data.telematicsHandover.setup.status', 'in_progress');

    expect($booking->fresh('telematicsSetupSession')->telematicsSetupSession->status)
        ->toBe(TelematicsSetupStatus::InProgress)
        ->and(Activity::query()->where('event', 'telematics_handover_started')->exists())->toBeTrue();
});

it('returns a sanitized handover summary only to the owning renter', function () {
    $booking = handoverBooking();
    finalizeFoundationOutgoing($booking);
    handoverSnapshot($booking);
    app(TelematicsSetupService::class)->startHandover($booking, vehicleManagerUser());
    $session = $booking->fresh('telematicsSetupSession')->telematicsSetupSession;
    app(TelematicsSetupService::class)->recordStep($session, TelematicsSetupStepType::DeviceCheck, TelematicsSetupStepStatus::Passed, ['private' => 'evidence']);

    Sanctum::actingAs($booking->user);
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup")
        ->assertOk()
        ->assertJsonPath('data.bookingCode', $booking->booking_code)
        ->assertJsonPath('data.setup.status', 'in_progress')
        ->assertJsonPath('data.geofence.name', 'Handover service area')
        ->assertJsonPath('data.steps.0.type', 'device_check')
        ->assertJsonPath('data.steps.0.attemptCount', 1)
        ->assertJsonMissing(['id'])
        ->assertJsonMissing(['evidence']);

    Sanctum::actingAs(customerUser());
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup")->assertNotFound();
});

it('keeps release gated until every latest check passes and preserves owner-driver release', function () {
    $booking = handoverBooking();
    finalizeFoundationOutgoing($booking);
    handoverSnapshot($booking);
    $service = app(TelematicsSetupService::class);
    $service->startHandover($booking, vehicleManagerUser());

    expect(fn () => app(BookingService::class)->transition($booking, BookingStatus::Ongoing, vehicleManagerUser()))
        ->toThrow(ValidationException::class);

    $session = $booking->fresh('telematicsSetupSession')->telematicsSetupSession;
    foreach (TelematicsSetupService::requiredSteps() as $type) {
        $service->recordStep($session, $type, TelematicsSetupStepStatus::Passed);
        $session->refresh();
    }
    $started = app(BookingService::class)->transition($booking, BookingStatus::Ongoing, vehicleManagerUser());
    expect($started->fresh('telematicsSetupSession')->telematicsSetupSession->status)->toBe(TelematicsSetupStatus::Released);

    $ownerDriver = handoverBooking(RentalType::OwnersDriver);
    finalizeFoundationOutgoing($ownerDriver);
    expect(app(BookingService::class)->transition($ownerDriver, BookingStatus::Ongoing, vehicleManagerUser())->status->value)
        ->toBe('ongoing');
});
