<?php

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Services\BookingService;
use App\Services\SelfDriveBookingAvailabilityService;
use App\Services\TelematicsSetupService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
});

function selfDriveReservationPayload(array $overrides = []): array
{
    $vehicle = availableVehicle();

    return array_merge([
        'vehicle_id' => $vehicle->id,
        'rental_start_at' => now()->addDay()->toISOString(),
        'rental_end_at' => now()->addDays(2)->toISOString(),
        'pickup_location_type' => 'shop', 'pickup_location' => 'Jamjade Garage', 'return_location' => 'Jamjade Garage',
        'driver_option' => 'self_drive', 'customer_signature' => 'signed', 'terms_version' => '2026-08-19',
        'late_return_policy_version' => lateReturnPolicyVersion($vehicle->id),
    ], $overrides);
}

it('blocks new overlapping reservations on different vehicles without changing existing bookings', function (BookingStatus $status) {
    $existing = telematicsFoundationBooking();
    $existing->update(['status' => $status]);
    $payload = selfDriveReservationPayload();
    $before = Booking::count();
    expect(fn () => app(BookingService::class)->createAwaitingPayPalPayment($existing->user, $payload))->toThrow(ValidationException::class);
    expect(Booking::count())->toBe($before)->and($existing->fresh()->status)->toBe($status);
})->with([BookingStatus::Pending, BookingStatus::Confirmed, BookingStatus::Ongoing]);

it('returns the overlap error on the rental start field through the customer endpoint', function () {
    $existing = telematicsFoundationBooking();
    Sanctum::actingAs($existing->user);
    $this->postJson('/api/mobile/bookings', selfDriveReservationPayload([
        'down_payment_amount' => 10000, 'payment_method' => 'GCash',
    ]))->assertUnprocessable()->assertJsonValidationErrors('rental_start_at');
});

it('allows adjacent dates and overlapping with-driver bookings', function () {
    $existing = telematicsFoundationBooking();
    $service = app(BookingService::class);
    $next = $service->createAwaitingPayPalPayment($existing->user, selfDriveReservationPayload([
        'rental_start_at' => $existing->rental_end_at->toISOString(),
        'rental_end_at' => $existing->rental_end_at->addDay()->toISOString(),
    ]));
    expect($next->status)->toBe(BookingStatus::Pending);
    $withDriver = $service->createAwaitingPayPalPayment($existing->user, selfDriveReservationPayload([
        'driver_option' => 'owners_driver', 'owner_driver_coverage' => 'metro_manila',
    ]));
    expect($withDriver->rental_type)->toBe(RentalType::OwnersDriver);
});

it('does not reserve customer dates for cancelled, rejected, returned or completed bookings', function (BookingStatus $status) {
    $existing = telematicsFoundationBooking();
    $existing->update(['status' => $status]);
    expect(app(BookingService::class)->createAwaitingPayPalPayment($existing->user, selfDriveReservationPayload())->status)->toBe(BookingStatus::Pending);
})->with([BookingStatus::Cancelled, BookingStatus::Rejected, BookingStatus::Returned, BookingStatus::Completed]);

it('preserves overlapping legacy bookings but allows only one active handover', function () {
    $first = telematicsFoundationBooking();
    $second = telematicsFoundationBooking();
    $second->update(['user_id' => $first->user_id]);
    $second->refresh();
    finalizeFoundationOutgoing($first);
    finalizeFoundationOutgoing($second);
    $service = app(TelematicsSetupService::class);
    $service->startHandover($first, vehicleManagerUser());
    expect(fn () => $service->startHandover($second, vehicleManagerUser()))->toThrow(ValidationException::class);

    Sanctum::actingAs($first->user);
    $this->getJson("/api/mobile/bookings/{$second->booking_code}/telematics-setup")
        ->assertOk()->assertJsonPath('data.eligibility.state', 'other_rental_active')
        ->assertJsonPath('data.eligibility.canWorkSetup', false);
    expect($first->fresh()->status)->toBe(BookingStatus::Confirmed)
        ->and($second->fresh()->status)->toBe(BookingStatus::Confirmed);
});

it('prevents a second release even for an overdue ongoing rental and in local test mode', function () {
    config(['telematics.handover_test_mode' => true]);
    $first = telematicsFoundationBooking();
    $first->update(['status' => BookingStatus::Ongoing, 'rental_end_at' => now()->subHour()]);
    $second = telematicsFoundationBooking();
    $second->update(['user_id' => $first->user_id]);
    $second->refresh();
    expect(app(SelfDriveBookingAvailabilityService::class)->canHandover($second))->toBeFalse();
    expect(fn () => app(BookingService::class)->transition($second, BookingStatus::Ongoing, vehicleManagerUser()))->toThrow(ValidationException::class);
    expect($second->fresh()->status)->toBe(BookingStatus::Confirmed);
});
