<?php

use App\Enums\BookingStatus;
use App\Enums\DocumentStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Enums\TelematicsSetupStatus;
use App\Models\Booking;
use App\Services\BookingInspectionService;
use App\Services\TelematicsSetupService;
use App\Services\VehicleInspectionService;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
});

afterEach(function () {
    CarbonImmutable::setTestNow();
});

function telematicsAccessBooking(BookingStatus $status = BookingStatus::Confirmed, RentalType $type = RentalType::SelfDrive, mixed $start = null): Booking
{
    $customer = customerUser();
    $vehicle = availableVehicle();
    $booking = Booking::create([
        'booking_code' => 'BK-ACCESS-'.str()->upper(str()->random(6)),
        'user_id' => $customer->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => $type,
        'rental_start_at' => $start ?? now()->subMinute(),
        'rental_end_at' => now()->addDays(2),
        'pickup_location_type' => $type === RentalType::SelfDrive ? 'shop' : 'delivery',
        'pickup_location' => 'Jamjade Garage',
        'return_location' => 'Jamjade Garage',
        'owner_driver_coverage' => $type === RentalType::OwnersDriver ? 'metro_manila' : null,
        'status' => $status,
        'payment_status' => PaymentStatus::Paid,
        'price_per_day' => 3500,
        'duration_days' => 1,
        'subtotal' => 3500,
        'remaining_balance' => 0,
        'total_amount' => 3500,
    ]);
    app(VehicleInspectionService::class)->configureInitial($vehicle, vehicleConditionPayload(), vehicleManagerUser());

    return $booking;
}

function prepareAccessHandover(Booking $booking): void
{
    app(BookingInspectionService::class)->finalizeOutgoing(
        $booking,
        vehicleConditionPayload(['odometer' => 1300]),
        vehicleSignatureDataUrl(),
        vehicleManagerUser(),
    );
    app(TelematicsSetupService::class)->assignGeofenceSnapshot($booking, null, [
        'name' => 'Access boundary',
        'center_latitude' => 14.299,
        'center_longitude' => 120.958,
        'radius_meters' => 1000,
    ], vehicleManagerUser());
}

it('returns no telematics handover for a renter without a self-drive booking', function () {
    Sanctum::actingAs(customerUser());

    $this->getJson('/api/mobile/telematics/setup')
        ->assertOk()
        ->assertJsonPath('data', null);
});

it('does not let an owners-driver booking activate renter telematics', function () {
    $booking = telematicsAccessBooking(BookingStatus::Confirmed, RentalType::OwnersDriver);
    Sanctum::actingAs($booking->user);

    $this->getJson('/api/mobile/telematics/setup')->assertOk()->assertJsonPath('data', null);
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup")->assertNotFound();
});

it('returns an authoritative locked state for a pending self-drive booking', function () {
    $booking = telematicsAccessBooking(BookingStatus::Pending);
    Sanctum::actingAs($booking->user);

    $this->getJson('/api/mobile/telematics/setup')
        ->assertOk()
        ->assertJsonPath('data.bookingCode', $booking->booking_code)
        ->assertJsonPath('data.eligibility.state', 'waiting_for_confirmation')
        ->assertJsonPath('data.eligibility.canWorkSetup', false);

    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup/steps/device_check/attempt", [
        'evidence' => [
            'accelerometer_available' => true,
            'gyroscope_available' => true,
            'location_services_available' => true,
            'platform' => 'android',
            'build_context' => 'standalone',
            'checked_at' => now()->toISOString(),
        ],
    ])->assertNotFound();
});

it('does not expose rejected or cancelled bookings through telematics setup routes', function (BookingStatus $status) {
    $booking = telematicsAccessBooking($status);
    Sanctum::actingAs($booking->user);

    $this->getJson('/api/mobile/telematics/setup')->assertOk()->assertJsonPath('data', null);
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup")->assertNotFound();
})->with([BookingStatus::Rejected, BookingStatus::Cancelled]);

it('reports incomplete document verification and keeps setup locked', function () {
    $booking = telematicsAccessBooking();
    $booking->user->documents()->firstOrFail()->update(['status' => DocumentStatus::Pending]);
    Sanctum::actingAs($booking->user);

    $this->getJson('/api/mobile/telematics/setup')
        ->assertOk()
        ->assertJsonPath('data.eligibility.documentsVerified', false)
        ->assertJsonPath('data.eligibility.state', 'verification_required')
        ->assertJsonPath('data.eligibility.canWorkSetup', false);
});

it('blocks staff handover before the booking rental date', function () {
    $booking = telematicsAccessBooking(BookingStatus::Confirmed, RentalType::SelfDrive, now()->addDay());
    prepareAccessHandover($booking);

    expect(fn () => app(TelematicsSetupService::class)->startHandover($booking, vehicleManagerUser()))
        ->toThrow(ValidationException::class);
});

it('allows a booking later today to start handover and work setup', function () {
    CarbonImmutable::setTestNow(CarbonImmutable::create(2026, 9, 18, 2, 0, 0, 'UTC'));
    $booking = telematicsAccessBooking(
        BookingStatus::Confirmed,
        RentalType::SelfDrive,
        CarbonImmutable::create(2026, 9, 18, 10, 0, 0, 'UTC'),
    );
    prepareAccessHandover($booking);

    app(TelematicsSetupService::class)->startHandover($booking, vehicleManagerUser());
    Sanctum::actingAs($booking->user);

    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup/steps/device_check/attempt", [
        'evidence' => [
            'accelerometer_available' => true,
            'gyroscope_available' => true,
            'location_services_available' => true,
            'platform' => 'android',
            'build_context' => 'standalone',
            'checked_at' => now()->toISOString(),
        ],
    ])->assertOk()->assertJsonPath('data.steps.0.status', 'passed');
});

it('does not allow tomorrow\'s booking to start handover', function () {
    CarbonImmutable::setTestNow(CarbonImmutable::create(2026, 9, 18, 2, 0, 0, 'UTC'));
    $booking = telematicsAccessBooking(
        BookingStatus::Confirmed,
        RentalType::SelfDrive,
        CarbonImmutable::create(2026, 9, 19, 1, 0, 0, 'UTC'),
    );
    prepareAccessHandover($booking);

    expect(fn () => app(TelematicsSetupService::class)->startHandover($booking, vehicleManagerUser()))
        ->toThrow(ValidationException::class);
});

it('starts handover only when the server reports the self-drive booking eligible', function () {
    $booking = telematicsAccessBooking();
    prepareAccessHandover($booking);

    $session = app(TelematicsSetupService::class)->startHandover($booking, vehicleManagerUser());

    expect($session->status)->toBe(TelematicsSetupStatus::InProgress);
});

it('prefers an in-progress confirmed handover over another confirmed self-drive booking', function () {
    $waitingBooking = telematicsAccessBooking();
    $handoverBooking = Booking::create([
        'booking_code' => 'BK-ACCESS-HANDOVER',
        'user_id' => $waitingBooking->user_id,
        'vehicle_id' => availableVehicle()->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->subMinute(),
        'rental_end_at' => now()->addDays(2),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Garage',
        'return_location' => 'Jamjade Garage',
        'status' => BookingStatus::Confirmed,
        'payment_status' => PaymentStatus::Paid,
        'price_per_day' => 3500,
        'duration_days' => 1,
        'subtotal' => 3500,
        'remaining_balance' => 0,
        'total_amount' => 3500,
    ]);
    app(VehicleInspectionService::class)->configureInitial($handoverBooking->vehicle, vehicleConditionPayload(), vehicleManagerUser());
    prepareAccessHandover($handoverBooking);
    app(TelematicsSetupService::class)->startHandover($handoverBooking, vehicleManagerUser());

    Sanctum::actingAs($waitingBooking->user);
    $this->getJson('/api/mobile/telematics/setup')
        ->assertOk()
        ->assertJsonPath('data.bookingCode', $handoverBooking->booking_code)
        ->assertJsonPath('data.eligibility.state', 'handover_in_progress');
});
