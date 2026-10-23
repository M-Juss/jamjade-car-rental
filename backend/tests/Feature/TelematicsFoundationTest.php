<?php

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Enums\TelematicsSetupStatus;
use App\Enums\TelematicsSetupStepStatus;
use App\Enums\TelematicsSetupStepType;
use App\Enums\VehicleInspectionStatus;
use App\Enums\VehicleStatus;
use App\Models\Booking;
use App\Models\Payment;
use App\Services\BookingInspectionService;
use App\Services\BookingService;
use App\Services\TelematicsService;
use App\Services\TelematicsSetupService;
use App\Services\VehicleInspectionService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Storage::fake('local');
});

function telematicsFoundationBooking(RentalType $type = RentalType::SelfDrive): Booking
{
    $customer = customerUser();
    $vehicle = availableVehicle();
    $driver = $type === RentalType::OwnersDriver ? createDriverUser() : null;
    $booking = Booking::create([
        'booking_code' => 'BK-TEL-'.strtoupper(Str::random(6)),
        'user_id' => $customer->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => $type,
        'rental_start_at' => now()->subMinute(),
        'rental_end_at' => now()->addDays(2),
        'pickup_location_type' => $type === RentalType::SelfDrive ? 'shop' : 'delivery',
        'pickup_location' => 'Jamjade Garage',
        'return_location' => 'Jamjade Garage',
        'owner_driver_coverage' => $type === RentalType::OwnersDriver ? 'metro_manila' : null,
        'assigned_driver_id' => $driver?->id,
        'driver_assigned_at' => $driver ? now() : null,
        'status' => BookingStatus::Confirmed,
        'payment_status' => PaymentStatus::Paid,
        'price_per_day' => 3500,
        'duration_days' => 2,
        'subtotal' => 7000,
        'remaining_balance' => 0,
        'total_amount' => 7000,
    ]);
    Payment::create([
        'booking_id' => $booking->id,
        'user_id' => $customer->id,
        'provider' => 'manual',
        'status' => 'completed',
        'amount' => 7000,
        'currency' => 'PHP',
        'completed_at' => now(),
    ]);
    app(VehicleInspectionService::class)->configureInitial($vehicle, vehicleConditionPayload(), vehicleManagerUser());

    return $booking->fresh(['user.customerProfile', 'user.documents', 'assignedDriver', 'vehicle']);
}

function finalizeFoundationOutgoing(Booking $booking): void
{
    app(BookingInspectionService::class)->finalizeOutgoing(
        $booking,
        vehicleConditionPayload(['odometer' => 1300]),
        vehicleSignatureDataUrl(),
        vehicleManagerUser()
    );
}

function readyFoundationSetup(Booking $booking): void
{
    $service = app(TelematicsSetupService::class);
    $session = $booking->fresh('telematicsSetupSession')->telematicsSetupSession;
    $service->startHandover($booking, vehicleManagerUser());
    $session->refresh();
    $operator = $booking->rental_type === RentalType::SelfDrive ? $booking->user : $booking->assignedDriver;
    foreach (TelematicsSetupService::requiredSteps() as $type) {
        $service->recordStep($session, $type, TelematicsSetupStepStatus::Passed, actor: $operator);
        $session->refresh();
    }
}

it('enables one setup session after a finalized self-drive outgoing inspection', function () {
    $booking = telematicsFoundationBooking();
    finalizeFoundationOutgoing($booking);

    $session = $booking->fresh('telematicsSetupSession')->telematicsSetupSession;
    expect($session->status)->toBe(TelematicsSetupStatus::SetupRequired)
        ->and($booking->vehicleInspections()->where('type', 'outgoing')->firstOrFail()->status)->toBe(VehicleInspectionStatus::Finalized);

    app(TelematicsSetupService::class)->enableForFinalizedOutgoing($booking);
    expect($booking->telematicsSetupSession()->count())->toBe(1);
});

it('requires the assigned Driver setup before releasing an owner-driver rental', function () {
    $booking = telematicsFoundationBooking(RentalType::OwnersDriver);
    finalizeFoundationOutgoing($booking);

    expect($booking->fresh('telematicsSetupSession')->telematicsSetupSession->status)->toBe(TelematicsSetupStatus::SetupRequired);
    expect(fn () => app(BookingService::class)->transition($booking, BookingStatus::Ongoing, vehicleManagerUser()))
        ->toThrow(ValidationException::class);
    readyFoundationSetup($booking);
    $started = app(BookingService::class)->transition($booking, BookingStatus::Ongoing, vehicleManagerUser());
    expect($started->status)->toBe(BookingStatus::Ongoing)
        ->and($started->fresh('telematicsSetupSession')->telematicsSetupSession->status)->toBe(TelematicsSetupStatus::Released)
        ->and($started->telematicsSetupSession->steps()->pluck('actor_user_id')->unique()->all())->toBe([$booking->assignedDriver->id]);
});

it('preserves setup-step retries and becomes ready only when every latest required step passes', function () {
    $booking = telematicsFoundationBooking();
    finalizeFoundationOutgoing($booking);
    $service = app(TelematicsSetupService::class);
    $session = $booking->fresh('telematicsSetupSession')->telematicsSetupSession;
    $service->startHandover($booking, vehicleManagerUser());
    $session->refresh();

    $service->recordStep($session, TelematicsSetupStepType::DeviceCheck, TelematicsSetupStepStatus::Failed, null, 'Bluetooth disabled');
    $service->recordStep($session, TelematicsSetupStepType::DeviceCheck, TelematicsSetupStepStatus::Passed);
    expect($session->steps()->where('step_type', TelematicsSetupStepType::DeviceCheck)->pluck('attempt_number')->all())->toBe([1, 2])
        ->and($service->isReady($session->fresh()))->toBeFalse();

    foreach (array_slice(TelematicsSetupService::requiredSteps(), 1) as $type) {
        $service->recordStep($session, $type, TelematicsSetupStepStatus::Passed);
        $session->refresh();
    }

    expect($session->fresh()->status)->toBe(TelematicsSetupStatus::ReadyForRelease)
        ->and($service->isReady($session->fresh()))->toBeTrue();
});

it('keeps assigned-driver release blocked when setup attempts belong to the Customer', function () {
    $booking = telematicsFoundationBooking(RentalType::OwnersDriver);
    finalizeFoundationOutgoing($booking);
    $manager = vehicleManagerUser();
    $service = app(TelematicsSetupService::class);
    $session = $service->startHandover($booking, $manager);

    foreach (TelematicsSetupService::requiredSteps() as $type) {
        $service->recordStep($session, $type, TelematicsSetupStepStatus::Passed, actor: $booking->user);
    }
    expect($service->isReady($session->fresh()))->toBeFalse();
    expect(fn () => app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $manager))
        ->toThrow(ValidationException::class);

    foreach (TelematicsSetupService::requiredSteps() as $type) {
        $service->recordStep($session, $type, TelematicsSetupStepStatus::Passed, actor: $booking->assignedDriver);
    }
    expect($service->isReady($session->fresh()))->toBeTrue();
    expect(app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $manager)->status)->toBe(BookingStatus::Ongoing);
});

it('blocks self-drive release before readiness then releases setup and keeps one trip with location history', function () {
    $booking = telematicsFoundationBooking();
    $manager = vehicleManagerUser();
    finalizeFoundationOutgoing($booking);
    expect(fn () => app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $manager))
        ->toThrow(ValidationException::class);

    readyFoundationSetup($booking);
    $started = app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $manager);
    expect($started->vehicle->status)->toBe(VehicleStatus::Rented)
        ->and($started->fresh('telematicsSetupSession')->telematicsSetupSession->status)->toBe(TelematicsSetupStatus::Released);

    $service = app(TelematicsService::class);
    $trip = $service->startTrip($booking->user, ['booking_id' => $booking->id, 'latitude' => 14.299, 'longitude' => 120.958]);
    $eventCount = $trip->events()->count();
    $capturedAt = now()->subMinute()->startOfSecond();
    $service->storeLocation($trip, [
        'latitude' => 14.300, 'longitude' => 120.959, 'accuracy' => 8.5, 'speed' => 22.4, 'heading' => 180,
        'captured_at' => $capturedAt,
    ], $booking->user);

    $point = $trip->locationPoints()->firstOrFail();
    expect($trip->events()->count())->toBe($eventCount)
        ->and($trip->locationPoints()->count())->toBe(1)
        ->and($point->captured_at->equalTo($capturedAt))->toBeTrue()
        ->and($point->received_at->greaterThan($point->captured_at))->toBeTrue()
        ->and(fn () => $service->startTrip($booking->user, ['booking_id' => $booking->id, 'latitude' => 14.299, 'longitude' => 120.958]))
        ->toThrow(ValidationException::class);
});
