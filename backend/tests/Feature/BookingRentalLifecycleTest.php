<?php

use App\Enums\AdditionalChargeResponsibility;
use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Enums\VehicleInspectionSignerType;
use App\Enums\VehicleStatus;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\User;
use App\Models\VehicleMaintenanceRecord;
use App\Services\AdditionalChargeService;
use App\Services\BookingInspectionService;
use App\Services\BookingService;
use App\Services\CalibrationService;
use App\Services\DriverAssignmentService;
use App\Services\TelematicsService;
use App\Services\VehicleInspectionService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Storage::fake('local');
});

function lifecycleBooking(RentalType $type = RentalType::SelfDrive, array $attributes = []): Booking
{
    $customer = customerUser();
    $vehicle = availableVehicle();
    $driver = $type === RentalType::OwnersDriver ? createDriverUser() : null;
    $booking = Booking::create(array_merge([
        'booking_code' => 'BK-LIFE-'.strtoupper(Str::random(6)),
        'user_id' => $customer->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => $type,
        'rental_start_at' => now()->addDays(3),
        'rental_end_at' => now()->addDays(5),
        'pickup_location_type' => $type === RentalType::SelfDrive ? 'shop' : 'delivery',
        'pickup_location' => 'Jamjade Garage',
        'return_location' => 'Jamjade Garage',
        'driver_option' => $type->value,
        'owner_driver_coverage' => $type === RentalType::OwnersDriver ? 'metro_manila' : null,
        'assigned_driver_id' => $driver?->id,
        'driver_assigned_at' => $driver ? now() : null,
        'status' => BookingStatus::Confirmed,
        'payment_status' => PaymentStatus::Paid,
        'price_per_day' => 3500,
        'duration_days' => 2,
        'subtotal' => 7000,
        'down_payment_amount' => 7000,
        'remaining_balance' => 0,
        'total_amount' => 7000,
    ], $attributes));
    Payment::create([
        'booking_id' => $booking->id,
        'user_id' => $customer->id,
        'payment_method' => 'PayPal',
        'payment_status' => PaymentStatus::Paid,
        'amount' => 7000,
        'transaction_id' => 'CAPTURE-'.$booking->id,
        'paid_at' => now(),
    ]);
    $manager = vehicleManagerUser();
    app(VehicleInspectionService::class)->configureInitial($vehicle, vehicleConditionPayload(), $manager);

    return $booking->fresh(['user.customerProfile', 'user.documents', 'assignedDriver', 'vehicle']);
}

function finalizeLifecycleInspection(Booking $booking, string $type, User $manager, int $odometer): void
{
    $condition = vehicleConditionPayload(['odometer' => $odometer]);
    if ($type === 'outgoing') {
        app(BookingInspectionService::class)->finalizeOutgoing($booking, $condition, vehicleSignatureDataUrl(), $manager);
    } else {
        app(BookingInspectionService::class)->finalizeIncoming($booking, $condition, vehicleSignatureDataUrl(), $manager);
    }
}

it('defines returned as the only ordinary transition after ongoing', function () {
    expect(BookingStatus::Ongoing->allowedTransitions())->toBe([BookingStatus::Returned])
        ->and(BookingStatus::Returned->allowedTransitions())->toBe([BookingStatus::Completed]);
});

it('rejects ordinary cancellation after rental start and keeps terminal states terminal', function () {
    $booking = lifecycleBooking();
    $actor = vehicleManagerUser();
    finalizeLifecycleInspection($booking, 'outgoing', $actor, 1300);
    app(CalibrationService::class)->recordPassed($booking, $booking->user);
    app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $actor);

    expect(fn () => app(BookingService::class)->transition($booking->fresh(), BookingStatus::Cancelled, $actor))
        ->toThrow(ValidationException::class)
        ->and(BookingStatus::Completed->allowedTransitions())->toBe([])
        ->and(BookingStatus::Cancelled->allowedTransitions())->toBe([])
        ->and(BookingStatus::Rejected->allowedTransitions())->toBe([]);
});

it('blocks start rental until outgoing and calibration are finalized', function () {
    $booking = lifecycleBooking();
    $actor = vehicleManagerUser();

    expect(fn () => app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $actor))
        ->toThrow(ValidationException::class);

    finalizeLifecycleInspection($booking, 'outgoing', $actor, 1300);
    expect($booking->fresh()->calibration_status)->toBe('available');
    app(CalibrationService::class)->recordPassed($booking, $booking->user);
    $started = app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $actor);

    expect($started->status)->toBe(BookingStatus::Ongoing)
        ->and($started->started_at)->not->toBeNull()
        ->and($started->vehicle->status)->toBe(VehicleStatus::Rented);
});

it('keeps outgoing immutable and current while incoming becomes the new current snapshot', function () {
    $booking = lifecycleBooking();
    $actor = vehicleManagerUser();
    $initialId = $booking->vehicle->current_condition_inspection_id;
    finalizeLifecycleInspection($booking, 'outgoing', $actor, 1300);
    $outgoing = $booking->vehicleInspections()->where('type', 'outgoing')->firstOrFail();

    expect($booking->vehicle->fresh()->current_condition_inspection_id)->toBe($initialId)
        ->and($outgoing->based_on_inspection_id)->toBe($initialId)
        ->and($outgoing->signatures()->get()->pluck('signer_type')->all())
        ->toContain(VehicleInspectionSignerType::Personnel, VehicleInspectionSignerType::Renter);

    app(CalibrationService::class)->recordPassed($booking, $booking->user);
    app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $actor);
    finalizeLifecycleInspection($booking->fresh(), 'incoming', $actor, 1450);
    $incoming = $booking->vehicleInspections()->where('type', 'incoming')->firstOrFail();

    expect($incoming->based_on_inspection_id)->toBe($outgoing->id)
        ->and($booking->vehicle->fresh()->current_condition_inspection_id)->toBe($incoming->id);
});

it('uses personnel and assigned Driver signatures without a customer signature for owner driver inspections', function () {
    $booking = lifecycleBooking(RentalType::OwnersDriver);
    $actor = vehicleManagerUser();
    finalizeLifecycleInspection($booking, 'outgoing', $actor, 1300);

    expect($booking->vehicleInspections()->where('type', 'outgoing')->firstOrFail()->signatures()->get()->pluck('signer_type')->all())
        ->toContain(VehicleInspectionSignerType::Personnel, VehicleInspectionSignerType::Driver)
        ->not->toContain(VehicleInspectionSignerType::Renter);
});

it('blocks owner driver outgoing without an assignment but permits confirmation without one', function () {
    $booking = lifecycleBooking(RentalType::OwnersDriver, ['assigned_driver_id' => null, 'driver_assigned_at' => null]);
    $actor = vehicleManagerUser();

    expect($booking->status)->toBe(BookingStatus::Confirmed)
        ->and(fn () => finalizeLifecycleInspection($booking, 'outgoing', $actor, 1300))
        ->toThrow(ValidationException::class);
});

it('does not auto assign a Driver when an owner driver booking is created', function () {
    createDriverUser();
    $user = customerUser();
    $vehicle = availableVehicle();

    $booking = app(BookingService::class)->createAwaitingPayPalPayment($user, [
        'vehicle_id' => $vehicle->id,
        'rental_start_at' => now()->addDays(3)->setTime(9, 30)->format('Y-m-d H:i'),
        'rental_end_at' => now()->addDays(5)->setTime(9, 30)->format('Y-m-d H:i'),
        'pickup_location' => 'Dasmarinas, Cavite',
        'return_location' => 'Dasmarinas, Cavite',
        'driver_option' => 'owners_driver',
        'owner_driver_coverage' => 'metro_manila',
        'customer_signature' => 'signed',
        'terms_version' => '2026-08-22',
    ]);

    expect($booking->assigned_driver_id)->toBeNull()
        ->and($booking->driver_assigned_at)->toBeNull();
});

it('ends telematics without returning the booking or releasing the vehicle', function () {
    $booking = lifecycleBooking();
    $actor = vehicleManagerUser();
    finalizeLifecycleInspection($booking, 'outgoing', $actor, 1300);
    app(CalibrationService::class)->recordPassed($booking, $booking->user);
    app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $actor);
    $trip = app(TelematicsService::class)->startTrip($booking->user, [
        'booking_id' => $booking->id, 'latitude' => 14.3, 'longitude' => 120.9,
    ]);
    app(TelematicsService::class)->endTrip($trip, $booking->user);

    expect($booking->fresh()->status)->toBe(BookingStatus::Ongoing)
        ->and($booking->vehicle->fresh()->status)->toBe(VehicleStatus::Rented)
        ->and($trip->fresh()->status)->toBe('ended');
});

it('separates customer and Driver charges and allows completion while Driver debt remains', function () {
    $booking = lifecycleBooking(RentalType::OwnersDriver);
    $actor = vehicleManagerUser();
    finalizeLifecycleInspection($booking, 'outgoing', $actor, 1300);
    app(CalibrationService::class)->recordPassed($booking, $booking->assignedDriver);
    app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $actor);
    finalizeLifecycleInspection($booking->fresh(), 'incoming', $actor, 1450);

    $charges = app(AdditionalChargeService::class)->create($booking, [
        ['type' => 'toll_fee', 'description' => 'Expressway toll', 'amount' => 500, 'responsibility' => 'customer'],
        ['type' => 'traffic_violation', 'description' => 'Traffic citation', 'amount' => 2000, 'responsibility' => 'driver'],
    ], $actor);

    expect($charges)->toHaveCount(2)
        ->and($booking->fresh()->remaining_balance)->toBe('500.00')
        ->and($booking->fresh()->payment_status)->toBe(PaymentStatus::Partial);

    app(AdditionalChargeService::class)->finalizeReview($booking, $actor);
    app(BookingService::class)->transition($booking->fresh(), BookingStatus::Returned, $actor);
    expect(fn () => app(BookingService::class)->transition($booking->fresh(), BookingStatus::Completed, $actor))
        ->toThrow(ValidationException::class);

    $customerCharge = collect($charges)->first(fn ($charge) => $charge->responsibility === AdditionalChargeResponsibility::Customer);
    $customerCharge->forceFill(['payment_status' => PaymentStatus::Paid, 'paid_at' => now()])->save();
    Payment::create([
        'booking_id' => $booking->id, 'user_id' => $booking->user_id, 'payment_method' => 'PayPal',
        'payment_status' => PaymentStatus::Paid, 'amount' => 500, 'transaction_id' => 'RETURN-500', 'paid_at' => now(),
    ]);
    app(AdditionalChargeService::class)->recomputeCustomerBalance($booking->fresh());
    $completed = app(BookingService::class)->transition($booking->fresh(), BookingStatus::Completed, $actor);

    expect($completed->status)->toBe(BookingStatus::Completed)
        ->and($completed->completed_by)->toBe($actor->id)
        ->and($booking->additionalCharges()->where('responsibility', 'driver')->first()->payment_status)->toBe(PaymentStatus::Unpaid);
});

it('forces Self Drive charges to customer responsibility', function () {
    $booking = lifecycleBooking();
    $actor = vehicleManagerUser();
    finalizeLifecycleInspection($booking, 'outgoing', $actor, 1300);
    app(CalibrationService::class)->recordPassed($booking, $booking->user);
    app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $actor);
    finalizeLifecycleInspection($booking->fresh(), 'incoming', $actor, 1400);

    $charge = app(AdditionalChargeService::class)->create($booking, [[
        'type' => 'cleaning', 'description' => 'Interior cleaning', 'amount' => 600, 'responsibility' => 'driver',
    ]], $actor)[0];

    expect($charge->responsibility)->toBe(AdditionalChargeResponsibility::Customer)
        ->and($charge->responsible_user_id)->toBe($booking->user_id)
        ->and($booking->fresh()->remaining_balance)->toBe('600.00');
});

it('rejects additional charge amounts with unsafe decimal precision', function () {
    $booking = lifecycleBooking();
    $actor = vehicleManagerUser();
    finalizeLifecycleInspection($booking, 'outgoing', $actor, 1300);
    app(CalibrationService::class)->recordPassed($booking, $booking->user);
    app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $actor);
    finalizeLifecycleInspection($booking->fresh(), 'incoming', $actor, 1400);

    $this->actingAs($actor)->postJson("/admin/bookings/{$booking->id}/additional-charges", [
        'charges' => [[
            'type' => 'other', 'description' => 'Unsafe precision', 'amount' => 0.001, 'responsibility' => 'customer',
        ]],
    ])->assertUnprocessable()->assertJsonValidationErrors('charges.0.amount');

    $this->assertDatabaseCount('booking_additional_charges', 0);
});

it('captures Driver charges idempotently without changing the customer balance', function () {
    config([
        'services.paypal.base_url' => 'https://api-m.sandbox.paypal.com',
        'services.paypal.client_id' => 'sandbox-client-id',
        'services.paypal.client_secret' => 'sandbox-client-secret',
    ]);
    Http::fake([
        'https://api-m.sandbox.paypal.com/v1/oauth2/token' => Http::response(['access_token' => 'token']),
        'https://api-m.sandbox.paypal.com/v2/checkout/orders' => Http::response([
            'id' => 'DRIVER-ORDER-1', 'status' => 'CREATED',
            'links' => [['href' => 'https://www.sandbox.paypal.com/pay/DRIVER-ORDER-1', 'rel' => 'payer-action']],
        ], 201),
        'https://api-m.sandbox.paypal.com/v2/checkout/orders/DRIVER-ORDER-1/capture' => Http::response([
            'status' => 'COMPLETED', 'purchase_units' => [['payments' => ['captures' => [[
                'id' => 'DRIVER-CAPTURE-1', 'status' => 'COMPLETED',
                'amount' => ['currency_code' => 'PHP', 'value' => '2000.00'],
            ]]]]],
        ]),
    ]);
    $booking = lifecycleBooking(RentalType::OwnersDriver);
    $actor = vehicleManagerUser();
    finalizeLifecycleInspection($booking, 'outgoing', $actor, 1300);
    app(CalibrationService::class)->recordPassed($booking, $booking->assignedDriver);
    app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $actor);
    finalizeLifecycleInspection($booking->fresh(), 'incoming', $actor, 1400);
    $charge = app(AdditionalChargeService::class)->create($booking, [[
        'type' => 'traffic_violation', 'description' => 'Traffic citation', 'amount' => 2000, 'responsibility' => 'driver',
    ]], $actor)[0];
    Sanctum::actingAs($booking->assignedDriver);

    $this->postJson("/api/mobile/driver/services/{$booking->booking_code}/paypal/orders", [
        'app_return_url' => 'mobilefrontend://paypal/driver-return',
        'app_cancel_url' => 'mobilefrontend://paypal/driver-cancel',
    ])->assertCreated()->assertJsonPath('data.amount', 2000);
    $this->postJson('/api/mobile/paypal/orders/DRIVER-ORDER-1/capture')->assertOk();
    $this->postJson('/api/mobile/paypal/orders/DRIVER-ORDER-1/capture')->assertOk();

    expect($charge->fresh()->payment_status)->toBe(PaymentStatus::Paid)
        ->and($booking->fresh()->remaining_balance)->toBe('0.00')
        ->and($booking->fresh()->payment_status)->toBe(PaymentStatus::Paid);
});

it('captures a customer return-charge balance idempotently while the booking is ongoing', function () {
    config([
        'services.paypal.base_url' => 'https://api-m.sandbox.paypal.com',
        'services.paypal.client_id' => 'sandbox-client-id',
        'services.paypal.client_secret' => 'sandbox-client-secret',
    ]);
    Http::fake([
        'https://api-m.sandbox.paypal.com/v1/oauth2/token' => Http::response(['access_token' => 'token']),
        'https://api-m.sandbox.paypal.com/v2/checkout/orders' => Http::response([
            'id' => 'CUSTOMER-RETURN-ORDER-1', 'status' => 'CREATED',
            'links' => [['href' => 'https://www.sandbox.paypal.com/pay/CUSTOMER-RETURN-ORDER-1', 'rel' => 'payer-action']],
        ], 201),
        'https://api-m.sandbox.paypal.com/v2/checkout/orders/CUSTOMER-RETURN-ORDER-1/capture' => Http::response([
            'status' => 'COMPLETED', 'purchase_units' => [['payments' => ['captures' => [[
                'id' => 'CUSTOMER-RETURN-CAPTURE-1', 'status' => 'COMPLETED',
                'amount' => ['currency_code' => 'PHP', 'value' => '500.00'],
            ]]]]],
        ]),
    ]);
    $booking = lifecycleBooking(attributes: ['balance_due_at' => now()->subDay()]);
    $actor = vehicleManagerUser();
    finalizeLifecycleInspection($booking, 'outgoing', $actor, 1300);
    app(CalibrationService::class)->recordPassed($booking, $booking->user);
    app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $actor);
    finalizeLifecycleInspection($booking->fresh(), 'incoming', $actor, 1400);
    $charge = app(AdditionalChargeService::class)->create($booking, [[
        'type' => 'toll_fee', 'description' => 'Expressway toll', 'amount' => 500,
    ]], $actor)[0];
    Sanctum::actingAs($booking->user);

    $notificationResponse = $this->getJson('/api/mobile/notifications')->assertOk();
    expect(collect($notificationResponse->json('data'))->contains(
        fn (array $notification) => $notification['bookingId'] === $booking->booking_code
            && data_get($notification, 'data.action') === 'pay_outstanding'
    ))->toBeTrue();

    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/paypal/orders", [
        'app_return_url' => 'mobilefrontend://paypal/return',
        'app_cancel_url' => 'mobilefrontend://paypal/cancel',
    ])->assertCreated()->assertJsonPath('data.amount', 500);
    $this->postJson('/api/mobile/paypal/orders/CUSTOMER-RETURN-ORDER-1/capture')->assertOk();
    $this->postJson('/api/mobile/paypal/orders/CUSTOMER-RETURN-ORDER-1/capture')->assertOk();

    expect($charge->fresh()->payment_status)->toBe(PaymentStatus::Paid)
        ->and($booking->fresh()->remaining_balance)->toBe('0.00')
        ->and($booking->fresh()->payment_status)->toBe(PaymentStatus::Paid)
        ->and($booking->payments()->where('transaction_id', 'CUSTOMER-RETURN-CAPTURE-1')->count())->toBe(1);
});

it('does not complete when a customer charge remains unpaid even if a generic payment made the numeric balance zero', function () {
    $booking = lifecycleBooking();
    $actor = vehicleManagerUser();
    finalizeLifecycleInspection($booking, 'outgoing', $actor, 1300);
    app(CalibrationService::class)->recordPassed($booking, $booking->user);
    app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $actor);
    finalizeLifecycleInspection($booking->fresh(), 'incoming', $actor, 1400);
    app(AdditionalChargeService::class)->create($booking, [[
        'type' => 'fuel', 'description' => 'Fuel top-up', 'amount' => 500,
    ]], $actor);
    app(AdditionalChargeService::class)->finalizeReview($booking, $actor);
    app(BookingService::class)->transition($booking->fresh(), BookingStatus::Returned, $actor);
    Payment::create([
        'booking_id' => $booking->id, 'user_id' => $booking->user_id, 'payment_method' => 'Manual',
        'payment_status' => PaymentStatus::Paid, 'amount' => 500, 'transaction_id' => 'GENERIC-500', 'paid_at' => now(),
    ]);
    app(AdditionalChargeService::class)->recomputeCustomerBalance($booking->fresh());

    expect($booking->fresh()->remaining_balance)->toBe('0.00')
        ->and(fn () => app(BookingService::class)->transition($booking->fresh(), BookingStatus::Completed, $actor))
        ->toThrow(ValidationException::class);
});

it('blocks a new Driver assignment when that Driver has an unpaid responsible charge', function () {
    $source = lifecycleBooking(RentalType::OwnersDriver);
    $actor = vehicleManagerUser();
    finalizeLifecycleInspection($source, 'outgoing', $actor, 1300);
    app(CalibrationService::class)->recordPassed($source, $source->assignedDriver);
    app(BookingService::class)->transition($source, BookingStatus::Ongoing, $actor);
    finalizeLifecycleInspection($source->fresh(), 'incoming', $actor, 1400);
    app(AdditionalChargeService::class)->create($source, [[
        'type' => 'other', 'description' => 'Driver accountability', 'amount' => 1000, 'responsibility' => 'driver',
    ]], $actor);
    $target = lifecycleBooking(RentalType::OwnersDriver, ['assigned_driver_id' => null, 'driver_assigned_at' => null]);

    expect(fn () => app(DriverAssignmentService::class)->assign($target, $source->assignedDriver))
        ->toThrow(ValidationException::class);
});

it('limits Driver service responses to assignments and redacts customer financial and document data', function () {
    $booking = lifecycleBooking(RentalType::OwnersDriver, ['admin_notes' => 'Internal return note']);
    Sanctum::actingAs($booking->assignedDriver);

    $this->getJson("/api/mobile/driver/services/{$booking->booking_code}")
        ->assertOk()
        ->assertJsonPath('data.totalAmount', 0)
        ->assertJsonPath('data.paymentStatus', 'Private')
        ->assertJsonCount(0, 'data.documents')
        ->assertJsonMissingPath('data.adminNotes')
        ->assertJsonMissingPath('data.customer.email')
        ->assertJsonMissingPath('data.customer.permissions');

    Sanctum::actingAs(createDriverUser());
    $this->getJson("/api/mobile/driver/services/{$booking->booking_code}")->assertNotFound();

    Sanctum::actingAs($booking->user);
    $this->getJson('/api/mobile/driver/services')->assertForbidden();
});

it('preserves an in-progress maintenance restriction when Returned releases the rental', function () {
    $booking = lifecycleBooking();
    $actor = vehicleManagerUser();
    finalizeLifecycleInspection($booking, 'outgoing', $actor, 1300);
    app(CalibrationService::class)->recordPassed($booking, $booking->user);
    app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $actor);
    finalizeLifecycleInspection($booking->fresh(), 'incoming', $actor, 1400);
    app(AdditionalChargeService::class)->finalizeReview($booking, $actor);
    VehicleMaintenanceRecord::create([
        'vehicle_id' => $booking->vehicle_id, 'title' => 'Emergency inspection', 'category' => 'corrective',
        'status' => 'in_progress', 'scheduled_start' => now(), 'scheduled_end' => now()->addDay(), 'created_by' => $actor->id,
    ]);
    app(BookingService::class)->transition($booking->fresh(), BookingStatus::Returned, $actor);

    expect($booking->vehicle->fresh()->status)->toBe(VehicleStatus::Maintenance);
});

it('preserves a manual unavailable state when Returned releases the rental', function () {
    $booking = lifecycleBooking();
    $actor = vehicleManagerUser();
    finalizeLifecycleInspection($booking, 'outgoing', $actor, 1300);
    app(CalibrationService::class)->recordPassed($booking, $booking->user);
    app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $actor);
    finalizeLifecycleInspection($booking->fresh(), 'incoming', $actor, 1400);
    app(AdditionalChargeService::class)->finalizeReview($booking, $actor);
    $booking->vehicle->forceFill(['status' => VehicleStatus::Unavailable])->save();

    app(BookingService::class)->transition($booking->fresh(), BookingStatus::Returned, $actor);

    expect($booking->vehicle->fresh()->status)->toBe(VehicleStatus::Unavailable);
});
