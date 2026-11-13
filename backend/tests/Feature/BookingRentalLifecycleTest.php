<?php

use App\Enums\AdditionalChargeResponsibility;
use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Enums\TelematicsSetupStatus;
use App\Enums\TelematicsSetupStepStatus;
use App\Enums\VehicleInspectionSignerType;
use App\Enums\VehicleStatus;
use App\Models\Booking;
use App\Models\Notification;
use App\Models\Payment;
use App\Models\User;
use App\Models\VehicleInspectionSignature;
use App\Models\VehicleMaintenanceRecord;
use App\Services\AdditionalChargeService;
use App\Services\BookingInspectionService;
use App\Services\BookingReturnService;
use App\Services\BookingService;
use App\Services\DriverAssignmentService;
use App\Services\PayPalCheckoutService;
use App\Services\PayPalClient;
use App\Services\RentalReadinessService;
use App\Services\TelematicsService;
use App\Services\TelematicsSetupService;
use App\Services\VehicleInspectionService;
use App\Services\VehicleOperationalStatusService;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
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

afterEach(fn () => CarbonImmutable::setTestNow());

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
        'rental_start_at' => now()->subMinute(),
        'rental_end_at' => now()->addDays(2),
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
        app(BookingReturnService::class)->receive($booking, $manager, now()->toISOString());
        app(BookingInspectionService::class)->finalizeIncoming($booking, $condition, vehicleSignatureDataUrl(), $manager);
    }
}

function legacyLifecycleOutgoing(Booking $booking): void
{
    // Seed a historical snapshot independently of the current timing policy.
    $baseline = $booking->vehicle->currentCondition;
    $inspection = $baseline->replicate();
    $inspection->forceFill([
        'booking_id' => $booking->id, 'type' => 'outgoing', 'status' => 'draft',
        'based_on_inspection_id' => $baseline->id, 'finalized_at' => null,
    ])->save();
    foreach ($baseline->items as $item) {
        $inspection->items()->save($item->replicate());
    }
    $manager = vehicleManagerUser();
    $operator = $booking->rental_type === RentalType::SelfDrive ? $booking->user : $booking->assignedDriver;
    foreach ([[$manager, VehicleInspectionSignerType::Personnel], [$operator, $booking->rental_type === RentalType::SelfDrive ? VehicleInspectionSignerType::Renter : VehicleInspectionSignerType::Driver]] as [$signer, $type]) {
        $inspection->signatures()->create([
            'user_id' => $signer->id, 'signer_name' => $signer->name, 'signer_type' => $type,
            'signature_path' => $baseline->signatures->first()->signature_path, 'signed_at' => now(),
        ]);
    }
    $inspection->forceFill(['status' => 'finalized', 'finalized_at' => now()])->save();
    app(TelematicsSetupService::class)->enableForFinalizedOutgoing($booking);
}

function completeTelematicsSetup(Booking $booking): void
{
    $service = app(TelematicsSetupService::class);
    $session = $booking->fresh('telematicsSetupSession')->telematicsSetupSession;
    $service->startHandover($booking, vehicleManagerUser());
    $session->refresh();

    $operator = $booking->rental_type === RentalType::SelfDrive ? $booking->user : $booking->assignedDriver;
    foreach (TelematicsSetupService::requiredSteps() as $step) {
        $service->recordStep($session, $step, TelematicsSetupStepStatus::Passed, actor: $operator);
        $session->refresh();
    }
}

it('requires an emergency contact before releasing an existing self-drive booking', function () {
    $booking = lifecycleBooking();
    $actor = vehicleManagerUser();
    finalizeLifecycleInspection($booking, 'outgoing', $actor, 1300);
    completeTelematicsSetup($booking);
    $booking->user->emergencyContacts()->delete();

    expect(app(RentalReadinessService::class)->evaluate($booking)['emergencyContactOnFile'])->toBeFalse();
    try {
        app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $actor);
        $this->fail('Release should require an emergency contact.');
    } catch (ValidationException $exception) {
        expect($exception->errors()['requirements'])->toBe(['emergencyContactOnFile']);
    }
    expect($booking->fresh()->status)->toBe(BookingStatus::Confirmed);

    addCustomerEmergencyContact($booking->user);
    expect(app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $actor)->status)
        ->toBe(BookingStatus::Ongoing);
});

it('finalizes outgoing only inside the booked interval for either rental type', function (RentalType $type, string $clock, bool $eligible) {
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-17T09:00:00+08:00')->utc());
    config(['telematics.handover_test_mode' => false, 'telematics.early_start_test_mode' => false]);
    $booking = lifecycleBooking($type, [
        'rental_start_at' => CarbonImmutable::parse('2026-10-17T20:20:00+08:00')->utc(),
        'rental_end_at' => CarbonImmutable::parse('2026-10-19T20:20:00+08:00')->utc(),
    ]);
    $files = Storage::disk('local')->allFiles();
    $manager = vehicleManagerUser();
    CarbonImmutable::setTestNow(CarbonImmutable::parse($clock)->utc());

    $this->actingAs($manager)->getJson("/admin/bookings/{$booking->id}")
        ->assertOk()->assertJsonPath('data.readiness.outgoingInspectionTimeEligible', $eligible);
    $response = $this->postJson("/admin/bookings/{$booking->id}/outgoing-inspection", [
        'condition' => vehicleConditionPayload(['odometer' => 1300]),
        'operator_signature_data' => vehicleSignatureDataUrl(),
    ]);
    if ($eligible) {
        $response->assertSuccessful();
        $inspection = $booking->vehicleInspections()->where('type', 'outgoing')->sole();
        expect($inspection->status->value)->toBe('finalized')
            ->and($inspection->finalized_at->toISOString())->toBe(now()->toISOString())
            ->and($inspection->signatures()->count())->toBe(2);
    } else {
        $response->assertUnprocessable()->assertJsonValidationErrors('booking');
        expect($booking->vehicleInspections()->count())->toBe(0)
            ->and(Storage::disk('local')->allFiles())->toBe($files);
    }
    expect($booking->fresh()->status)->toBe(BookingStatus::Confirmed)
        ->and($booking->vehicle->fresh()->current_condition_inspection_id)->toBe($booking->vehicle->current_condition_inspection_id);
})->with([RentalType::SelfDrive, RentalType::OwnersDriver])->with([
    'previous date' => ['2026-10-16T23:59:59+08:00', false],
    'same date across UTC midnight' => ['2026-10-17T00:30:00+08:00', true],
    'just before start' => ['2026-10-17T20:19:59+08:00', true],
    'exact start' => ['2026-10-17T20:20:00+08:00', true],
    'later pickup on another day' => ['2026-10-18T10:00:00+08:00', true],
    'just before end' => ['2026-10-19T20:19:59+08:00', true],
    'exact end' => ['2026-10-19T20:20:00+08:00', false],
    'expired' => ['2026-10-19T20:20:01+08:00', false],
]);

it('allows inspection on pickup day while release follows the rental timing rule', function (RentalType $type, string $environment, bool $earlyMode, bool $handoverMode, string $clock, bool $eligible) {
    CarbonImmutable::setTestNow(CarbonImmutable::parse($clock)->utc());
    config(['telematics.handover_test_mode' => $handoverMode, 'telematics.early_start_test_mode' => $earlyMode]);
    app()->instance('env', $environment);
    $booking = lifecycleBooking($type, [
        'rental_start_at' => CarbonImmutable::parse('2026-10-18T10:20:00+08:00')->utc(),
        'rental_end_at' => CarbonImmutable::parse('2026-10-19T10:20:00+08:00')->utc(),
    ]);
    $state = app(RentalReadinessService::class)->evaluate($booking);
    $inspectionEligible = CarbonImmutable::parse($clock)->gte(CarbonImmutable::parse('2026-10-18T00:00:00+08:00'))
        && CarbonImmutable::parse($clock)->lt(CarbonImmutable::parse('2026-10-19T10:20:00+08:00'));
    expect($state['rentalPeriodEligible'])->toBe($eligible)
        ->and($state['outgoingInspectionTimeEligible'])->toBe($inspectionEligible);
    $this->actingAs(vehicleManagerUser())->getJson("/admin/bookings/{$booking->id}")
        ->assertOk()->assertJsonPath('data.readiness.outgoingInspectionTimeEligible', $inspectionEligible);
    $response = $this->withSession(['_token' => 'SAME-DAY-TEST-CSRF'])
        ->withHeader('X-CSRF-TOKEN', 'SAME-DAY-TEST-CSRF')
        ->postJson("/admin/bookings/{$booking->id}/outgoing-inspection", [
            'condition' => vehicleConditionPayload(), 'operator_signature_data' => vehicleSignatureDataUrl(),
        ]);
    if ($inspectionEligible) {
        $response->assertSuccessful();
        expect($booking->vehicleInspections()->where('type', 'outgoing')->sole()->status->value)->toBe('finalized');
    } else {
        $response->assertUnprocessable()->assertJsonValidationErrors('booking');
        expect($booking->vehicleInspections()->exists())->toBeFalse();
    }
    expect($booking->fresh()->rental_start_at->toISOString())->toBe('2026-10-18T02:20:00.000000Z')
        ->and($booking->fresh()->rental_end_at->toISOString())->toBe('2026-10-19T02:20:00.000000Z');
})->with([RentalType::SelfDrive, RentalType::OwnersDriver])->with([
    'early customer on same Manila date across UTC midnight' => ['local', true, false, '2026-10-18T02:20:00+08:00', true],
    'broader local timing allowance' => ['testing', false, true, '2026-10-18T02:20:00+08:00', true],
    'future rental date' => ['testing', true, false, '2026-10-17T23:59:59+08:00', false],
    'exact rental start' => ['testing', true, false, '2026-10-18T10:20:00+08:00', true],
    'later pickup during rental' => ['testing', true, false, '2026-10-19T09:00:00+08:00', true],
    'exact return deadline' => ['testing', true, false, '2026-10-19T10:20:00+08:00', false],
    'expired rental' => ['testing', true, false, '2026-10-19T10:20:01+08:00', false],
    'temporary mode disabled' => ['testing', false, false, '2026-10-18T02:20:00+08:00', true],
    'production ignores temporary modes' => ['production', true, true, '2026-10-18T02:20:00+08:00', true],
    'staging ignores temporary modes' => ['staging', true, true, '2026-10-18T02:20:00+08:00', true],
]);

it('keeps previously finalized outgoing inspections readable outside the booked interval', function (RentalType $type) {
    $booking = lifecycleBooking($type, ['rental_start_at' => now()->addDay(), 'rental_end_at' => now()->addDays(2)]);
    legacyLifecycleOutgoing($booking);
    $inspection = $booking->vehicleInspections()->where('type', 'outgoing')->sole();
    $attributes = $inspection->getAttributes();
    $signatures = $inspection->signatures()->get()->toArray();
    $this->actingAs(vehicleManagerUser())->getJson("/admin/bookings/{$booking->id}")
        ->assertOk()->assertJsonPath('data.readiness.outgoingInspectionTimeEligible', false)
        ->assertJsonPath('data.readiness.outgoingFinalized', true)
        ->assertJsonPath('data.inspections.0.status', 'finalized');
    expect($inspection->fresh()->getAttributes())->toBe($attributes)
        ->and($inspection->signatures()->get()->toArray())->toBe($signatures);
})->with([RentalType::SelfDrive, RentalType::OwnersDriver]);

it('rechecks outgoing timing and rolls back when the deadline passes during finalization', function (RentalType $type, string $stage) {
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-17T09:00:00+08:00')->utc());
    $booking = lifecycleBooking($type, ['rental_end_at' => now()->addMinute()]);
    $manager = vehicleManagerUser();
    $files = Storage::disk('local')->allFiles();
    $deadline = CarbonImmutable::instance($booking->rental_end_at);
    if ($stage === 'signature upload') {
        $storage = app(VehicleInspectionService::class);
        $stored = 0;
        $this->partialMock(VehicleInspectionService::class, function ($mock) use ($storage, $deadline, &$stored) {
            $mock->shouldReceive('storePersonnelSignature')->twice()->andReturnUsing(function ($data, $field) use ($storage, $deadline, &$stored) {
                $path = $storage->storePersonnelSignature($data, $field);
                if (++$stored === 2) {
                    CarbonImmutable::setTestNow($deadline);
                }

                return $path;
            });
        });
    } else {
        Event::listen('eloquent.created: '.VehicleInspectionSignature::class, function (VehicleInspectionSignature $signature) use ($deadline) {
            if ($signature->signer_type !== VehicleInspectionSignerType::Personnel) {
                CarbonImmutable::setTestNow($deadline);
            }
        });
    }
    expect(fn () => finalizeLifecycleInspection($booking, 'outgoing', $manager, 1300))->toThrow(ValidationException::class);
    expect($booking->vehicleInspections()->count())->toBe(0)
        ->and($booking->fresh()->status)->toBe(BookingStatus::Confirmed)
        ->and(Storage::disk('local')->allFiles())->toBe($files)
        ->and($booking->telematicsSetupSession()->exists())->toBeFalse();
})->with([RentalType::SelfDrive, RentalType::OwnersDriver])->with(['signature upload', 'snapshot persistence']);

it('defines returned as the only ordinary transition after ongoing', function () {
    expect(BookingStatus::Ongoing->allowedTransitions())->toBe([BookingStatus::Returned])
        ->and(BookingStatus::Returned->allowedTransitions())->toBe([BookingStatus::Completed]);
});

it('rejects ordinary cancellation after rental start and keeps terminal states terminal', function () {
    $booking = lifecycleBooking();
    $actor = vehicleManagerUser();
    finalizeLifecycleInspection($booking, 'outgoing', $actor, 1300);
    completeTelematicsSetup($booking);
    app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $actor);

    expect(fn () => app(BookingService::class)->transition($booking->fresh(), BookingStatus::Cancelled, $actor))
        ->toThrow(ValidationException::class)
        ->and(BookingStatus::Completed->allowedTransitions())->toBe([])
        ->and(BookingStatus::Cancelled->allowedTransitions())->toBe([])
        ->and(BookingStatus::Rejected->allowedTransitions())->toBe([]);
});

it('blocks self-drive start rental until outgoing inspection and telematics setup are ready', function () {
    $booking = lifecycleBooking();
    $actor = vehicleManagerUser();

    expect(fn () => app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $actor))
        ->toThrow(ValidationException::class);

    finalizeLifecycleInspection($booking, 'outgoing', $actor, 1300);
    expect($booking->fresh()->telematicsSetupSession?->status)->toBe(TelematicsSetupStatus::SetupRequired);
    completeTelematicsSetup($booking);
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

    completeTelematicsSetup($booking);
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
        'pickup_location_type' => 'shop',
        'terms_version' => '2026-08-22',
        'late_return_policy_version' => lateReturnPolicyVersion($vehicle->id),
    ]);

    expect($booking->assigned_driver_id)->toBeNull()
        ->and($booking->driver_assigned_at)->toBeNull();
});

it('ends telematics without returning the booking or releasing the vehicle', function () {
    $booking = lifecycleBooking();
    $actor = vehicleManagerUser();
    finalizeLifecycleInspection($booking, 'outgoing', $actor, 1300);
    completeTelematicsSetup($booking);
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
    completeTelematicsSetup($booking);
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
    $payment = Payment::create([
        'booking_id' => $booking->id, 'user_id' => $booking->user_id, 'payment_method' => 'PayPal',
        'payment_status' => PaymentStatus::Paid, 'amount' => 500, 'transaction_id' => 'RETURN-500', 'paid_at' => now(),
    ]);
    $payment->additionalCharges()->attach($customerCharge->id, ['amount' => 500]);
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
    completeTelematicsSetup($booking);
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
    completeTelematicsSetup($booking);
    app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $actor);
    finalizeLifecycleInspection($booking->fresh(), 'incoming', $actor, 1400);

    $this->actingAs($actor)->postJson("/admin/bookings/{$booking->id}/additional-charges", [
        'charges' => [[
            'type' => 'other', 'description' => 'Unsafe precision', 'amount' => 0.001, 'responsibility' => 'customer',
        ]],
    ])->assertUnprocessable()->assertJsonValidationErrors('charges.0.amount');

    $this->assertDatabaseCount('booking_additional_charges', 0);
});

it('captures only the outstanding portion of a Driver charge without changing the customer balance', function () {
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
                'amount' => ['currency_code' => 'PHP', 'value' => '1500.00'],
            ]]]]],
        ]),
    ]);
    $booking = lifecycleBooking(RentalType::OwnersDriver);
    $actor = vehicleManagerUser();
    finalizeLifecycleInspection($booking, 'outgoing', $actor, 1300);
    completeTelematicsSetup($booking);
    app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $actor);
    finalizeLifecycleInspection($booking->fresh(), 'incoming', $actor, 1400);
    $charge = app(AdditionalChargeService::class)->create($booking, [[
        'type' => 'traffic_violation', 'description' => 'Traffic citation', 'amount' => 2000, 'responsibility' => 'driver',
    ]], $actor)[0];
    $partialPayment = Payment::create([
        'booking_id' => $booking->id, 'user_id' => $booking->assigned_driver_id, 'payment_method' => 'Manual',
        'payment_status' => PaymentStatus::Paid, 'amount' => 500, 'transaction_id' => 'DRIVER-PARTIAL-500', 'paid_at' => now(),
    ]);
    $partialPayment->additionalCharges()->attach($charge->id, ['amount' => 500]);
    Sanctum::actingAs($booking->assignedDriver);

    $this->postJson("/api/mobile/driver/services/{$booking->booking_code}/paypal/orders", [
        'app_return_url' => 'mobilefrontend://paypal/driver-return',
        'app_cancel_url' => 'mobilefrontend://paypal/driver-cancel',
    ])->assertCreated()->assertJsonPath('data.amount', 1500);
    $this->postJson('/api/mobile/paypal/orders/DRIVER-ORDER-1/capture')->assertOk();
    $this->postJson('/api/mobile/paypal/orders/DRIVER-ORDER-1/capture')->assertOk();

    expect($charge->fresh()->payment_status)->toBe(PaymentStatus::Paid)
        ->and((float) $charge->payments()->where('payments.provider_transaction_id', 'DRIVER-CAPTURE-1')->firstOrFail()->pivot->amount)->toBe(1500.0)
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
    completeTelematicsSetup($booking);
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
        ->and($booking->payments()->where('provider_transaction_id', 'CUSTOMER-RETURN-CAPTURE-1')->count())->toBe(1);
});

it('does not complete when a customer charge remains unpaid even if a generic payment made the numeric balance zero', function () {
    $booking = lifecycleBooking();
    $actor = vehicleManagerUser();
    finalizeLifecycleInspection($booking, 'outgoing', $actor, 1300);
    completeTelematicsSetup($booking);
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
    completeTelematicsSetup($source);
    app(BookingService::class)->transition($source, BookingStatus::Ongoing, $actor);
    finalizeLifecycleInspection($source->fresh(), 'incoming', $actor, 1400);
    app(AdditionalChargeService::class)->create($source, [[
        'type' => 'other', 'description' => 'Driver accountability', 'amount' => 1000, 'responsibility' => 'driver',
    ]], $actor);
    $target = lifecycleBooking(RentalType::OwnersDriver, ['assigned_driver_id' => null, 'driver_assigned_at' => null]);

    expect(fn () => app(DriverAssignmentService::class)->assign($target, $source->assignedDriver))
        ->toThrow(ValidationException::class);
});

it('exposes authoritative release timing for both rental types', function (RentalType $type, string $clock, bool $eligible) {
    $booking = lifecycleBooking($type, [
        'rental_start_at' => CarbonImmutable::parse('2026-10-19T09:00:00+08:00')->utc(),
        'rental_end_at' => CarbonImmutable::parse('2026-10-20T09:00:00+08:00')->utc(),
    ]);
    CarbonImmutable::setTestNow(CarbonImmutable::parse($clock)->utc());

    $this->actingAs(vehicleManagerUser())->getJson("/admin/bookings/{$booking->id}")
        ->assertOk()
        ->assertJsonPath('data.readiness.rentalPeriodEligible', $eligible);

    if (! $eligible) {
        $this->postJson("/admin/bookings/{$booking->id}/start")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('booking');
        expect($booking->fresh()->status)->toBe(BookingStatus::Confirmed);
    }
})->with([
    'self drive' => [RentalType::SelfDrive],
    'assigned driver' => [RentalType::OwnersDriver],
])->with([
    'before pickup date' => ['2026-10-18T12:00:00+08:00', false],
    'before pickup time' => ['2026-10-19T08:59:59+08:00', true],
    'at pickup time' => ['2026-10-19T09:00:00+08:00', true],
    'later in reserved period' => ['2026-10-20T08:59:59+08:00', true],
    'at return time' => ['2026-10-20T09:00:00+08:00', false],
    'after return time' => ['2026-10-20T09:00:01+08:00', false],
]);

it('starts an assigned-driver rental earlier on its start date in local test mode without moving the reserved period', function () {
    config(['telematics.handover_test_mode' => true]);
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-17T00:30:00+08:00')->utc());
    $booking = lifecycleBooking(RentalType::OwnersDriver, [
        'rental_start_at' => CarbonImmutable::parse('2026-10-17T20:20:00+08:00')->utc(),
        'rental_end_at' => CarbonImmutable::parse('2026-10-18T20:20:00+08:00')->utc(),
    ]);
    $manager = vehicleManagerUser();
    finalizeLifecycleInspection($booking, 'outgoing', $manager, 1300);
    completeTelematicsSetup($booking);

    $this->actingAs($manager)->getJson("/admin/bookings/{$booking->id}")
        ->assertOk()->assertJsonPath('data.readiness.rentalPeriodEligible', true);
    $this->postJson("/admin/bookings/{$booking->id}/start")->assertOk();

    expect($booking->fresh()->status)->toBe(BookingStatus::Ongoing)
        ->and($booking->vehicle->fresh()->status)->toBe(VehicleStatus::Rented)
        ->and($booking->fresh()->rental_start_at->toISOString())->toBe('2026-10-17T12:20:00.000000Z')
        ->and($booking->fresh()->rental_end_at->toISOString())->toBe('2026-10-18T12:20:00.000000Z')
        ->and($booking->fresh('telematicsSetupSession')->telematicsSetupSession->status)->toBe(TelematicsSetupStatus::Released);
});

it('keeps assigned-driver release timing bounded in test mode', function (string $environment, bool $testMode, string $clock, bool $eligible) {
    config(['telematics.handover_test_mode' => $testMode]);
    CarbonImmutable::setTestNow(CarbonImmutable::parse($clock)->utc());
    $booking = lifecycleBooking(RentalType::OwnersDriver, [
        'rental_start_at' => CarbonImmutable::parse('2026-10-17T20:20:00+08:00')->utc(),
        'rental_end_at' => CarbonImmutable::parse('2026-10-18T20:20:00+08:00')->utc(),
    ]);
    $manager = vehicleManagerUser();
    CarbonImmutable::setTestNow(CarbonImmutable::instance($booking->rental_start_at));
    legacyLifecycleOutgoing($booking);
    completeTelematicsSetup($booking);
    CarbonImmutable::setTestNow(CarbonImmutable::parse($clock)->utc());
    app()->instance('env', $environment);

    $this->actingAs($manager)->getJson("/admin/bookings/{$booking->id}")
        ->assertOk()->assertJsonPath('data.readiness.rentalPeriodEligible', $eligible)
        ->assertJsonPath('data.readiness.telematicsSetupReady', true);
    if ($eligible) {
        expect(app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $manager)->status)
            ->toBe(BookingStatus::Ongoing);
    } else {
        expect(fn () => app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $manager))
            ->toThrow(ValidationException::class);
        expect($booking->fresh()->status)->toBe(BookingStatus::Confirmed);
    }
})->with([
    'local same start date' => ['local', true, '2026-10-17T00:30:00+08:00', true],
    'future start date' => ['testing', true, '2026-10-16T23:59:59+08:00', false],
    'later booked day' => ['testing', true, '2026-10-18T10:00:00+08:00', true],
    'return deadline' => ['testing', true, '2026-10-18T20:20:00+08:00', false],
    'test mode disabled' => ['testing', false, '2026-10-17T00:30:00+08:00', true],
    'production ignores test mode' => ['production', true, '2026-10-17T00:30:00+08:00', true],
    'staging ignores test mode' => ['staging', true, '2026-10-17T00:30:00+08:00', true],
]);

it('retains assigned-driver readiness requirements during early same-day testing', function () {
    config(['telematics.handover_test_mode' => true]);
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-17T00:30:00+08:00')->utc());
    $booking = lifecycleBooking(RentalType::OwnersDriver, [
        'rental_start_at' => CarbonImmutable::parse('2026-10-17T20:20:00+08:00')->utc(),
        'rental_end_at' => CarbonImmutable::parse('2026-10-18T20:20:00+08:00')->utc(),
        'payment_status' => PaymentStatus::Partial,
        'remaining_balance' => 3500,
        'assigned_driver_id' => null,
        'driver_assigned_at' => null,
    ]);

    $this->actingAs(vehicleManagerUser())->getJson("/admin/bookings/{$booking->id}")
        ->assertOk()->assertJsonPath('data.readiness.rentalPeriodEligible', true)
        ->assertJsonPath('data.readiness.fullyPaid', false)
        ->assertJsonPath('data.readiness.outgoingFinalized', false)
        ->assertJsonPath('data.readiness.driverAssigned', false);
    $this->postJson("/admin/bookings/{$booking->id}/start")
        ->assertUnprocessable()->assertJsonValidationErrors('readiness');
    expect($booking->fresh()->status)->toBe(BookingStatus::Confirmed);
});

it('includes the vehicle plate in management booking lists and release details', function (string $role) {
    $manager = User::factory()->create();
    $manager->assignRole($role);
    $booking = lifecycleBooking(RentalType::OwnersDriver);

    $this->actingAs($manager)->getJson('/admin/bookings')
        ->assertOk()
        ->assertJsonPath('data.0.vehiclePlateNumber', $booking->vehicle->plate_number);

    $this->getJson("/admin/bookings/{$booking->id}")
        ->assertOk()
        ->assertJsonPath('data.vehiclePlateNumber', $booking->vehicle->plate_number);
})->with(['admin', 'staff']);

it('limits Driver service responses to assignments and redacts customer financial and document data', function () {
    $booking = lifecycleBooking(RentalType::OwnersDriver, ['admin_notes' => 'Internal return note']);
    $booking->vehicle->update(['name' => 'Hiace', 'brand' => 'Toyota', 'model' => 'GL Grandia', 'plate_number' => 'TST-1234']);
    Sanctum::actingAs($booking->assignedDriver);

    $this->getJson('/api/mobile/driver/services')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.vehicleName', 'Hiace')
        ->assertJsonPath('data.0.brand', 'Toyota')
        ->assertJsonPath('data.0.model', 'GL Grandia')
        ->assertJsonPath('data.0.vehiclePlateNumber', 'TST-1234')
        ->assertJsonPath('data.0.customer', [
            'name' => $booking->user->name,
            'phoneNumber' => $booking->user->phone_number,
        ]);

    $this->getJson("/api/mobile/driver/services/{$booking->booking_code}")
        ->assertOk()
        ->assertJsonPath('data.vehiclePlateNumber', 'TST-1234')
        ->assertJsonPath('data.customer', [
            'name' => $booking->user->name,
            'phoneNumber' => $booking->user->phone_number,
        ])
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
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}")
        ->assertOk()
        ->assertJsonMissingPath('data.vehiclePlateNumber');
});

it('preserves an in-progress maintenance restriction when Returned releases the rental', function () {
    $booking = lifecycleBooking();
    $actor = vehicleManagerUser();
    finalizeLifecycleInspection($booking, 'outgoing', $actor, 1300);
    completeTelematicsSetup($booking);
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
    completeTelematicsSetup($booking);
    app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $actor);
    finalizeLifecycleInspection($booking->fresh(), 'incoming', $actor, 1400);
    app(AdditionalChargeService::class)->finalizeReview($booking, $actor);
    $booking->vehicle->forceFill(['status' => VehicleStatus::Unavailable])->save();

    app(BookingService::class)->transition($booking->fresh(), BookingStatus::Returned, $actor);

    expect($booking->vehicle->fresh()->status)->toBe(VehicleStatus::Unavailable);
});

function editableLifecycleCharge(RentalType $type = RentalType::SelfDrive): array
{
    $booking = lifecycleBooking($type);
    $actor = vehicleManagerUser();
    finalizeLifecycleInspection($booking, 'outgoing', $actor, 1300);
    completeTelematicsSetup($booking);
    app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $actor);
    finalizeLifecycleInspection($booking->fresh(), 'incoming', $actor, 1400);
    $data = ['type' => 'fuel', 'description' => 'Synthetic fuel charge', 'amount' => 200, 'responsibility' => 'customer'];
    $charge = app(AdditionalChargeService::class)->create($booking, [$data], $actor)[0];

    return [$booking->fresh(), $actor, $charge, $data];
}

it('updates an individual open return charge and recalculates the Customer balance', function () {
    [$booking, $actor, $charge, $data] = editableLifecycleCharge();
    $data = [...$data, 'type' => 'cleaning', 'description' => 'Updated synthetic charge', 'amount' => 350.25];
    $this->actingAs($actor);
    verifiedOwnerWrite($this, 'PUT', "/admin/bookings/{$booking->id}/additional-charges/{$charge->id}", ['charges' => [$data]])
        ->assertOk()->assertJsonPath('data.amount', 350.25)->assertJsonPath('data.description', $data['description']);
    expect($booking->fresh()->total_amount)->toBe('7350.25')
        ->and($booking->fresh()->remaining_balance)->toBe('350.25')
        ->and($charge->fresh()->created_by)->toBe($actor->id)
        ->and($booking->additionalCharges()->count())->toBe(1);
    $this->assertDatabaseHas('activity_log', ['event' => 'booking_additional_charge_updated']);
});

it('deletes an individual unpaid return charge and restores the Customer balance', function () {
    [$booking, $actor, $charge] = editableLifecycleCharge();
    $this->actingAs($actor);
    verifiedOwnerWrite($this, 'DELETE', "/admin/bookings/{$booking->id}/additional-charges/{$charge->id}")->assertOk();
    expect($booking->fresh()->total_amount)->toBe('7000.00')
        ->and($booking->fresh()->remaining_balance)->toBe('0.00')
        ->and($booking->fresh()->payment_status)->toBe(PaymentStatus::Paid);
    $this->assertDatabaseMissing('booking_additional_charges', ['id' => $charge->id]);
    $this->assertDatabaseHas('activity_log', ['event' => 'booking_additional_charge_deleted']);
});

it('adjusts Customer totals when an open charge moves between Customer and Driver', function () {
    [$booking, $actor, $charge, $data] = editableLifecycleCharge(RentalType::OwnersDriver);
    $endpoint = "/admin/bookings/{$booking->id}/additional-charges/{$charge->id}";
    $this->actingAs($actor);
    verifiedOwnerWrite($this, 'PUT', $endpoint, ['charges' => [[...$data, 'responsibility' => 'driver', 'amount' => 450]]])->assertOk();
    expect($booking->fresh()->remaining_balance)->toBe('0.00')
        ->and($charge->fresh()->responsible_user_id)->toBe($booking->assigned_driver_id);
    verifiedOwnerWrite($this, 'PUT', $endpoint, ['charges' => [[...$data, 'amount' => 125]]])->assertOk();
    expect($booking->fresh()->remaining_balance)->toBe('125.00')
        ->and($charge->fresh()->responsible_user_id)->toBe($booking->user_id);
});

it('validates single-charge updates before changing amounts', function (array $invalid, string $field) {
    [$booking, $actor, $charge, $data] = editableLifecycleCharge();
    $this->actingAs($actor)->putJson("/admin/bookings/{$booking->id}/additional-charges/{$charge->id}", [
        'charges' => [[...$data, ...$invalid]],
    ])->assertUnprocessable()->assertJsonValidationErrors($field);
    expect($charge->fresh()->amount)->toBe('200.00')->and($booking->fresh()->remaining_balance)->toBe('200.00');
})->with([
    'zero' => [['amount' => 0], 'charges.0.amount'],
    'precision' => [['amount' => 1.001], 'charges.0.amount'],
    'maximum' => [['amount' => 10000000], 'charges.0.amount'],
    'empty description' => [['description' => ''], 'charges.0.description'],
    'long description' => [['description' => str_repeat('x', 1001)], 'charges.0.description'],
    'late type bypass' => [['type' => 'late_return'], 'charges.0.type'],
    'invalid responsibility' => [['responsibility' => 'staff'], 'charges.0.responsibility'],
]);

it('denies charge mutations without permission and across booking ownership boundaries', function () {
    [$booking, $actor, $charge, $data] = editableLifecycleCharge();
    $endpoint = "/admin/bookings/{$booking->id}/additional-charges/{$charge->id}";
    $this->putJson($endpoint, ['charges' => [$data]])->assertUnauthorized();
    $this->actingAs($booking->user)->putJson($endpoint, ['charges' => [$data]])->assertForbidden();
    $this->deleteJson($endpoint)->assertForbidden();
    $other = lifecycleBooking();
    $foreignEndpoint = "/admin/bookings/{$other->id}/additional-charges/{$charge->id}";
    $this->actingAs($actor);
    verifiedOwnerWrite($this, 'PUT', $foreignEndpoint, ['charges' => [$data]])->assertNotFound();
    verifiedOwnerWrite($this, 'DELETE', $foreignEndpoint)->assertNotFound();
    $this->putJson($endpoint, ['charges' => [$data, $data]])->assertUnprocessable()->assertJsonValidationErrors('charges');
});

it('locks charges with payment history including pending or failed checkouts', function (string $status) {
    [$booking, $actor, $charge, $data] = editableLifecycleCharge();
    $payment = Payment::create([
        'booking_id' => $booking->id, 'user_id' => $booking->user_id, 'provider' => 'paypal',
        'purpose' => 'remaining_balance', 'status' => $status, 'amount' => 50,
    ]);
    $payment->additionalCharges()->attach($charge->id, ['amount' => 50]);
    $endpoint = "/admin/bookings/{$booking->id}/additional-charges/{$charge->id}";
    $this->actingAs($actor);
    verifiedOwnerWrite($this, 'PUT', $endpoint, ['charges' => [[...$data, 'amount' => 100]]])->assertUnprocessable()->assertJsonValidationErrors('charges');
    verifiedOwnerWrite($this, 'DELETE', $endpoint)->assertUnprocessable()->assertJsonValidationErrors('charges');
    expect($charge->fresh()->amount)->toBe('200.00')
        ->and($payment->fresh()->additionalCharges()->count())->toBe(1);
})->with(['creating', 'created', 'completed', 'failed', 'refunded']);

it('locks finalized and reviewed late charges against editing or deletion', function () {
    [$booking, $actor, $charge, $data] = editableLifecycleCharge();
    $late = app(AdditionalChargeService::class)->create($booking, [[...$data, 'type' => 'late_return']], $actor, true)[0];
    $this->actingAs($actor);
    verifiedOwnerWrite($this, 'PUT', "/admin/bookings/{$booking->id}/additional-charges/{$late->id}", ['charges' => [$data]])->assertUnprocessable();
    verifiedOwnerWrite($this, 'DELETE', "/admin/bookings/{$booking->id}/additional-charges/{$late->id}")->assertUnprocessable();
    app(AdditionalChargeService::class)->finalizeReview($booking, $actor);
    $endpoint = "/admin/bookings/{$booking->id}/additional-charges/{$charge->id}";
    verifiedOwnerWrite($this, 'PUT', $endpoint, ['charges' => [$data]])->assertUnprocessable();
    verifiedOwnerWrite($this, 'DELETE', $endpoint)->assertUnprocessable();
    expect($booking->additionalCharges()->count())->toBe(2);
});

it('reserves an outstanding checkout before contacting the payment provider', function () {
    [$booking, $actor, $charge, $data] = editableLifecycleCharge();
    $this->mock(PayPalClient::class, function ($mock) use ($booking, $actor, $charge, $data) {
        $mock->shouldReceive('createOrder')->once()->andReturnUsing(function () use ($booking, $actor, $charge, $data) {
            expect(fn () => app(AdditionalChargeService::class)->update($booking, $charge->id, [...$data, 'amount' => 50], $actor))
                ->toThrow(ValidationException::class);
            expect(fn () => app(AdditionalChargeService::class)->delete($booking, $charge->id, $actor))
                ->toThrow(ValidationException::class);

            return ['id' => 'TEST-RESERVED-ORDER', 'links' => [['rel' => 'approve', 'href' => 'https://www.sandbox.paypal.com/checkoutnow?token=TEST-RESERVED-ORDER']]];
        });
    });
    app(PayPalCheckoutService::class)->createBalanceOrder($booking->user, $booking->booking_code, [
        'app_return_url' => 'mobilefrontend://paypal/success', 'app_cancel_url' => 'mobilefrontend://paypal/cancel',
    ]);
    expect($charge->fresh()->amount)->toBe('200.00');
});

it('finalizes charges and returns the vehicle together while Customer settlement remains due', function () {
    [$booking, $actor, $charge] = editableLifecycleCharge();
    $receivedAt = $booking->returnRecord->vehicle_received_at->toISOString();

    $this->actingAs($actor)->postJson("/admin/bookings/{$booking->id}/finalize-return")
        ->assertOk()->assertJsonPath('data.statusKey', 'returned')
        ->assertJsonPath('data.remainingBalance', 200)
        ->assertJsonPath('data.readiness.returnChargesFinalized', true);

    $saved = $booking->fresh();
    expect($saved->return_charges_finalized_at)->not->toBeNull()
        ->and($saved->return_charges_finalized_by)->toBe($actor->id)
        ->and($saved->returned_at)->not->toBeNull()
        ->and($saved->completed_at)->toBeNull()
        ->and($saved->vehicle->status)->toBe(VehicleStatus::Available)
        ->and($saved->returnRecord->vehicle_received_at->toISOString())->toBe($receivedAt)
        ->and($saved->events()->where('event_type', 'return_charges_finalized')->count())->toBe(1);
    $this->postJson("/admin/bookings/{$booking->id}/complete")->assertUnprocessable();
    verifiedOwnerWrite($this, 'PUT', "/admin/bookings/{$booking->id}/additional-charges/{$charge->id}", ['charges' => [[
        'type' => 'fuel', 'description' => 'Locked charge', 'amount' => 300, 'responsibility' => 'customer',
    ]]])->assertUnprocessable();
});

it('shows only completed customer payments in the management booking breakdown', function () {
    $booking = lifecycleBooking(RentalType::OwnersDriver, ['total_amount' => 8500]);
    $booking->payments()->create([
        'user_id' => $booking->user_id, 'provider' => 'paypal', 'purpose' => 'remaining_balance',
        'status' => 'completed', 'currency' => 'PHP', 'amount' => 1500,
    ]);
    $booking->payments()->create([
        'user_id' => $booking->assigned_driver_id, 'provider' => 'paypal', 'purpose' => 'driver_outstanding',
        'status' => 'completed', 'currency' => 'PHP', 'amount' => 500,
    ]);
    $booking->payments()->create([
        'user_id' => $booking->user_id, 'provider' => 'paypal', 'purpose' => 'remaining_balance',
        'status' => 'pending', 'currency' => 'PHP', 'amount' => 400,
    ]);

    $this->actingAs(vehicleManagerUser())->getJson("/admin/bookings/{$booking->id}")
        ->assertOk()
        ->assertJsonPath('data.totalAmount', 8500)
        ->assertJsonPath('data.customerPaidAmount', 8500)
        ->assertJsonPath('data.remainingBalance', 0);
});

it('returns a zero-charge booking without completing it and makes retries safe after completion', function () {
    [$booking, $actor, $charge] = editableLifecycleCharge();
    app(AdditionalChargeService::class)->delete($booking, $charge->id, $actor);
    $this->actingAs($actor)->postJson("/admin/bookings/{$booking->id}/finalize-return")
        ->assertOk()->assertJsonPath('data.statusKey', 'returned')->assertJsonPath('data.remainingBalance', 0);
    expect($booking->fresh()->completed_at)->toBeNull();
    $this->postJson("/admin/bookings/{$booking->id}/complete")->assertOk()->assertJsonPath('data.statusKey', 'completed');
    $completedAt = $booking->fresh()->completed_at->toISOString();
    $this->postJson("/admin/bookings/{$booking->id}/finalize-return")->assertOk()->assertJsonPath('data.statusKey', 'completed');
    expect($booking->fresh()->completed_at->toISOString())->toBe($completedAt)
        ->and($booking->events()->where('event_type', 'return_charges_finalized')->count())->toBe(1)
        ->and($booking->events()->where('new_status', 'returned')->count())->toBe(1);
});

it('resumes an already-finalized open return and does not duplicate events or notices on retry', function () {
    [$booking, $actor] = editableLifecycleCharge();
    app(AdditionalChargeService::class)->finalizeReview($booking, $actor);
    $finalizedAt = $booking->fresh()->return_charges_finalized_at->toISOString();
    $this->actingAs($actor)->postJson("/admin/bookings/{$booking->id}/finalize-return")->assertOk();
    $returnedAt = $booking->fresh()->returned_at->toISOString();
    $this->postJson("/admin/bookings/{$booking->id}/finalize-return")->assertOk()->assertJsonPath('data.statusKey', 'returned');
    expect($booking->fresh()->return_charges_finalized_at->toISOString())->toBe($finalizedAt)
        ->and($booking->fresh()->returned_at->toISOString())->toBe($returnedAt)
        ->and($booking->events()->where('event_type', 'return_charges_finalized')->count())->toBe(1)
        ->and($booking->events()->where('new_status', 'returned')->count())->toBe(1)
        ->and(Notification::where('booking_id', $booking->id)->where('title', 'Vehicle returned')->count())->toBe(1);
});

it('rolls charge finalization back if the return transition fails', function () {
    [$booking, $actor] = editableLifecycleCharge();
    $activities = DB::table('activity_log')->count();
    $notices = Notification::where('booking_id', $booking->id)->count();
    $this->partialMock(VehicleOperationalStatusService::class, function ($mock) {
        $mock->shouldReceive('afterBookingEnded')->once()->andThrow(new RuntimeException('Synthetic return failure'));
    });

    expect(fn () => app(BookingService::class)->finalizeReturn($booking, $actor))->toThrow(RuntimeException::class);
    expect($booking->fresh()->status)->toBe(BookingStatus::Ongoing)
        ->and($booking->fresh()->return_charges_finalized_at)->toBeNull()
        ->and($booking->fresh()->returned_at)->toBeNull()
        ->and($booking->vehicle->fresh()->status)->toBe(VehicleStatus::Rented)
        ->and(DB::table('activity_log')->count())->toBe($activities)
        ->and(Notification::where('booking_id', $booking->id)->count())->toBe($notices);
});

it('preserves vehicle restrictions when the combined return finishes', function (string $restriction) {
    [$booking, $actor] = editableLifecycleCharge();
    if ($restriction === 'maintenance') {
        VehicleMaintenanceRecord::create([
            'vehicle_id' => $booking->vehicle_id, 'title' => 'Synthetic inspection', 'category' => 'corrective',
            'status' => 'in_progress', 'scheduled_start' => now(), 'scheduled_end' => now()->addDay(), 'created_by' => $actor->id,
        ]);
    } else {
        $booking->vehicle->forceFill(['status' => VehicleStatus::Unavailable])->save();
    }
    $this->actingAs($actor)->postJson("/admin/bookings/{$booking->id}/finalize-return")->assertOk();
    expect($booking->vehicle->fresh()->status->value)->toBe($restriction);
})->with(['maintenance', 'unavailable']);

it('keeps Driver debt separate when finalizing and completing the return', function () {
    [$booking, $actor, $charge, $data] = editableLifecycleCharge(RentalType::OwnersDriver);
    app(AdditionalChargeService::class)->update($booking, $charge->id, [...$data, 'responsibility' => 'driver'], $actor);
    $this->actingAs($actor)->postJson("/admin/bookings/{$booking->id}/finalize-return")->assertOk()->assertJsonPath('data.remainingBalance', 0);
    $this->postJson("/admin/bookings/{$booking->id}/complete")->assertOk();
    expect($charge->fresh()->payment_status)->toBe(PaymentStatus::Unpaid)
        ->and($charge->fresh()->responsibility)->toBe(AdditionalChargeResponsibility::Driver);
});

it('rejects combined return before received time and Incoming Inspection are saved', function (bool $received) {
    $booking = lifecycleBooking(RentalType::OwnersDriver);
    $actor = vehicleManagerUser();
    finalizeLifecycleInspection($booking, 'outgoing', $actor, 1300);
    completeTelematicsSetup($booking);
    app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $actor);
    if ($received) {
        app(BookingReturnService::class)->receive($booking->fresh(), $actor, now()->toISOString());
    }
    $this->actingAs($actor)->postJson("/admin/bookings/{$booking->id}/finalize-return")->assertUnprocessable()->assertJsonValidationErrors('booking');
    expect($booking->fresh()->status)->toBe(BookingStatus::Ongoing)
        ->and($booking->fresh()->return_charges_finalized_at)->toBeNull();
})->with([false, true]);

it('rejects combined return from states outside the active return workflow', function (string $status) {
    $booking = lifecycleBooking(RentalType::OwnersDriver, ['status' => $status]);
    $this->actingAs(vehicleManagerUser())->postJson("/admin/bookings/{$booking->id}/finalize-return")
        ->assertUnprocessable()->assertJsonValidationErrors('booking');
    expect($booking->fresh()->status->value)->toBe($status)
        ->and($booking->fresh()->return_charges_finalized_at)->toBeNull();
})->with(['pending', 'confirmed', 'cancelled', 'rejected', 'returned', 'completed']);

it('authorizes the combined return only for booking management', function (string $role) {
    [$booking] = editableLifecycleCharge();
    $actor = $role === 'customer' ? $booking->user : ($role === 'driver' ? createDriverUser() : User::factory()->create());
    $this->actingAs($actor)->postJson("/admin/bookings/{$booking->id}/finalize-return")->assertForbidden();
    expect($booking->fresh()->status)->toBe(BookingStatus::Ongoing)
        ->and($booking->fresh()->return_charges_finalized_at)->toBeNull();
})->with(['customer', 'driver', 'unassigned']);

it('allows authorized Staff to finalize the combined return', function () {
    [$booking] = editableLifecycleCharge();
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $this->actingAs($staff)->postJson("/admin/bookings/{$booking->id}/finalize-return")
        ->assertOk()->assertJsonPath('data.statusKey', 'returned');
});
