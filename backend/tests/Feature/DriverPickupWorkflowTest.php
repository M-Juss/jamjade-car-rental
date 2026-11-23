<?php

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Enums\TelematicsSetupStepStatus;
use App\Mail\BookingDriverUpdateMail;
use App\Models\Booking;
use App\Models\BookingDriverUpdate;
use App\Models\BookingPaymentDocument;
use App\Models\Notification;
use App\Models\User;
use App\Services\BookingDriverUpdateService;
use App\Services\BookingInspectionService;
use App\Services\DriverAssignmentService;
use App\Services\DriverPickupService;
use App\Services\TelematicsSetupService;
use App\Services\VehicleInspectionService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    $this->freezeTime();
    Storage::fake('local');
    Mail::fake();
});

function pickupWorkflowBooking(bool $inspected = true, string $pickup = 'delivery'): Booking
{
    $customer = customerUser();
    $driver = createDriverUser();
    $vehicle = availableVehicle();
    $booking = Booking::create([
        'booking_code' => 'BK-PICKUP-'.Str::upper(Str::random(6)), 'user_id' => $customer->id, 'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::OwnersDriver, 'driver_option' => 'owners_driver',
        'rental_start_at' => now()->subMinute(), 'rental_end_at' => now()->addDay(),
        'pickup_location_type' => $pickup, 'pickup_location' => 'Test pickup', 'return_location' => 'Test pickup',
        'assigned_driver_id' => $driver->id, 'driver_assigned_at' => now(),
        'status' => BookingStatus::Confirmed, 'payment_status' => PaymentStatus::Paid,
        'price_per_day' => 3500, 'duration_days' => 1, 'subtotal' => 3500, 'total_amount' => 3500, 'remaining_balance' => 0,
    ]);
    $manager = vehicleManagerUser();
    app(VehicleInspectionService::class)->configureInitial($vehicle, vehicleConditionPayload(), $manager);
    if ($inspected) {
        app(BookingInspectionService::class)->finalizeOutgoing($booking, vehicleConditionPayload(['odometer' => 1300]), vehicleSignatureDataUrl(), $manager);
    }

    return $booking->fresh();
}

it('blocks departure until outgoing is finalized and limits actions to the current Driver', function () {
    $booking = pickupWorkflowBooking(false);
    Sanctum::actingAs($booking->assignedDriver);
    $this->getJson('/api/mobile/driver/services/'.$booking->id)->assertOk()->assertJsonPath('data.driverWorkflow.canReportOnWay', false);
    $this->postJson('/api/mobile/driver/services/'.$booking->id.'/workflow', ['action' => 'on_way'])->assertUnprocessable();
    expect($booking->assignment->on_way_at)->toBeNull();
    Sanctum::actingAs(createDriverUser());
    $this->postJson('/api/mobile/driver/services/'.$booking->id.'/workflow', ['action' => 'on_way'])->assertForbidden();
    Sanctum::actingAs($booking->user);
    $this->postJson('/api/mobile/driver/services/'.$booking->id.'/workflow', ['action' => 'start_rental'])->assertForbidden();
});

it('locks driver changes after outgoing including stale clients', function () {
    $booking = pickupWorkflowBooking();
    $driverId = $booking->assignedDriver->id;
    $replacement = createDriverUser();
    $this->actingAs(vehicleManagerUser())->postJson('/admin/bookings/'.$booking->id.'/assign-driver', ['driver_id' => $replacement->id])
        ->assertUnprocessable()->assertJsonValidationErrors('driver_id');
    expect($booking->fresh()->assignment->driver_id)->toBe($driverId);
});

it('records departure and arrival once and enables setup only after arrival', function () {
    $booking = pickupWorkflowBooking();
    $driver = $booking->assignedDriver;
    Sanctum::actingAs($driver);
    $endpoint = '/api/mobile/driver/services/'.$booking->id.'/workflow';
    $this->postJson($endpoint, ['action' => 'arrived'])->assertUnprocessable();
    foreach (range(1, 2) as $_) {
        $this->postJson($endpoint, ['action' => 'on_way'])->assertOk()->assertJsonPath('data.driverWorkflow.status', 'on_way');
    }
    $this->getJson('/api/mobile/bookings/'.$booking->booking_code.'/telematics-setup')->assertOk()->assertJsonPath('data.canBeginSetup', false);
    foreach (range(1, 2) as $_) {
        $this->postJson($endpoint, ['action' => 'arrived'])->assertOk()->assertJsonPath('data.driverWorkflow.canBeginSetup', true);
    }
    expect($booking->events()->whereIn('event_type', ['driver_on_way', 'driver_arrived'])->count())->toBe(2)
        ->and(BookingDriverUpdate::count())->toBe(2)
        ->and(Notification::where('user_id', $booking->user_id)->count())->toBe(2)
        ->and($booking->telematicsTrips()->count())->toBe(0)
        ->and($booking->fresh()->status)->toBe(BookingStatus::Confirmed);
    $this->postJson($endpoint, ['action' => 'start_rental'])->assertUnprocessable();
    expect($booking->fresh()->status)->toBe(BookingStatus::Confirmed);
});

it('lets an inspected garage pickup report arrival directly', function () {
    $booking = pickupWorkflowBooking(pickup: 'shop');
    Sanctum::actingAs($booking->assignedDriver);
    $this->postJson('/api/mobile/driver/services/'.$booking->id.'/workflow', ['action' => 'arrived'])->assertOk();
    expect($booking->fresh()->assignment->on_way_at)->toBeNull()
        ->and($booking->fresh()->assignment->arrived_at)->not->toBeNull();
});

it('lets the current Driver explicitly release only after arrival and all readiness checks', function () {
    $booking = pickupWorkflowBooking();
    $driver = $booking->assignedDriver;
    app(DriverPickupService::class)->act($booking, $driver, 'on_way');
    app(DriverPickupService::class)->act($booking, $driver, 'arrived');
    $session = $booking->fresh()->telematicsSetupSession;
    foreach (TelematicsSetupService::requiredSteps() as $step) {
        app(TelematicsSetupService::class)->recordStep($session, $step, TelematicsSetupStepStatus::Passed, actor: $driver);
        $session->refresh();
    }
    Sanctum::actingAs($driver);
    $endpoint = '/api/mobile/driver/services/'.$booking->id.'/workflow';
    $booking->update(['payment_status' => PaymentStatus::Partial, 'remaining_balance' => 100]);
    $this->postJson($endpoint, ['action' => 'start_rental'])->assertUnprocessable();
    $booking->update(['payment_status' => PaymentStatus::Paid, 'remaining_balance' => 0]);
    $this->getJson('/api/mobile/driver/services/'.$booking->id)->assertOk()->assertJsonPath('data.driverWorkflow.canStartRental', true);
    foreach (range(1, 2) as $_) {
        $this->postJson($endpoint, ['action' => 'start_rental'])->assertOk()->assertJsonPath('data.status', 'Active');
    }
    expect($booking->fresh()->telematicsSetupSession->status->value)->toBe('released')
        ->and($booking->events()->where('new_status', 'ongoing')->count())->toBe(1)
        ->and($booking->telematicsTrips()->count())->toBe(0);
});

it('rejects stale departed updates when the booking is cancelled or outside its dates', function (string $state) {
    $booking = pickupWorkflowBooking();
    if ($state === 'cancelled') {
        $booking->update(['status' => BookingStatus::Cancelled]);
    } elseif ($state === 'future') {
        $booking->update(['rental_start_at' => now()->addDay(), 'rental_end_at' => now()->addDays(2)]);
    } else {
        $booking->update(['rental_end_at' => now()]);
    }
    Sanctum::actingAs($booking->assignedDriver);
    $this->postJson('/api/mobile/driver/services/'.$booking->id.'/workflow', ['action' => 'on_way'])->assertUnprocessable();
    expect(BookingDriverUpdate::count())->toBe(0);
})->with(['cancelled', 'expired', 'future']);

it('keeps no-op assignments quiet and sends current driver details separately from receipts', function () {
    $booking = pickupWorkflowBooking(false);
    $replacement = createDriverUser(['name' => 'Replacement Driver', 'email' => 'replacement@example.test', 'phone_number' => '09170000888']);
    $service = app(DriverAssignmentService::class);
    $service->assign($booking, $replacement);
    $service->assign($booking, $replacement);
    $update = BookingDriverUpdate::sole();
    expect(Notification::where('user_id', $booking->user_id)->sole()->full_message)->toContain('replacement@example.test', '09170000888');
    app(BookingDriverUpdateService::class)->deliver($update->id);
    app(BookingDriverUpdateService::class)->deliver($update->id);
    Mail::assertSent(BookingDriverUpdateMail::class, 1);
    expect($update->fresh()->delivery_status)->toBe('sent');
});

it('keeps assignment and its customer notice when email fails and retries the same update', function () {
    $booking = pickupWorkflowBooking(false);
    $mailFake = Mail::getFacadeRoot();
    Mail::shouldReceive('to')->andThrow(new RuntimeException('Synthetic transport failure'));
    app(DriverAssignmentService::class)->assign($booking, createDriverUser());
    $update = BookingDriverUpdate::sole();
    expect(app(BookingDriverUpdateService::class)->deliver($update->id))->toBeFalse()
        ->and($update->fresh()->delivery_status)->toBe('failed')
        ->and($booking->fresh()->assignment->driver_id)->toBe($update->driver_id);
    Mail::swap($mailFake);
    app(BookingDriverUpdateService::class)->deliver($update->id);
    Mail::assertSent(BookingDriverUpdateMail::class, 1);
    expect(Notification::where('user_id', $booking->user_id)->count())->toBe(1);
});

it('does not select a Driver without a phone and preserves a confirmed booking when none qualifies', function () {
    $booking = pickupWorkflowBooking(false);
    $booking->assignment()->delete();
    foreach (User::role('driver')->get() as $driver) {
        $driver->update(['phone_number' => null]);
    }
    expect(app(DriverAssignmentService::class)->autoAssign($booking))->toBeNull()
        ->and($booking->fresh()->status)->toBe(BookingStatus::Confirmed)
        ->and($booking->assignment()->exists())->toBeFalse();
});

it('assigns before issuing a paid booking PDF and keeps confirmation when no Driver is available', function (bool $available) {
    $driver = $available ? createDriverUser(['name' => 'Assigned Person', 'email' => 'assigned@example.test', 'phone_number' => '09170000886']) : null;
    $customer = customerUser();
    $vehicle = availableVehicle();
    Sanctum::actingAs($customer);
    $response = $this->postJson('/api/mobile/bookings', [
        'vehicle_id' => $vehicle->id, 'rental_start_at' => now()->addDays(3)->toISOString(), 'rental_end_at' => now()->addDays(4)->toISOString(),
        'pickup_location_type' => 'shop', 'pickup_location' => 'Jamjade Garage', 'return_location' => 'Jamjade Garage',
        'driver_option' => 'owners_driver', 'owner_driver_coverage' => 'metro_manila',
        'down_payment_amount' => 2100, 'payment_method' => 'GCash', 'transaction_id' => 'SYNTHETIC-DRIVER-PAYMENT',
        'customer_signature' => 'Test Customer', 'terms_version' => '2026-10-12', 'late_return_policy_version' => lateReturnPolicyVersion($vehicle->id),
    ])->assertCreated()->assertJsonPath('data.status', 'Confirmed');
    $booking = Booking::where('user_id', $customer->id)->sole();
    $document = BookingPaymentDocument::where('booking_id', $booking->id)->sole();
    expect($booking->payments()->where('status', 'completed')->count())->toBe(1);
    if ($available) {
        $response->assertJsonPath('data.assignedDriver.id', $driver->id)->assertJsonPath('data.assignedDriver.email', $driver->email);
        expect($document->context['driver']['email'])->toBe($driver->email);
        $originalPdf = Storage::disk('local')->get($document->rental_information_path);
        $replacement = createDriverUser(['email' => 'new-driver@example.test']);
        app(DriverAssignmentService::class)->assign($booking, $replacement);
        expect($document->fresh()->context['driver']['email'])->toBe($driver->email)
            ->and(Storage::disk('local')->get($document->rental_information_path))->toBe($originalPdf)
            ->and($booking->fresh()->assignedDriver->email)->toBe('new-driver@example.test');
    } else {
        $response->assertJsonPath('data.assignedDriver', null);
        $this->actingAs(vehicleManagerUser())->getJson('/admin/bookings/'.$booking->id)->assertOk()->assertJsonPath('data.driverAssignmentRequired', true);
    }
})->with([true, false]);

it('prevents early release or departure while the assigned Driver still has another ongoing service', function () {
    $booking = pickupWorkflowBooking();
    $driver = $booking->assignedDriver;
    $other = pickupWorkflowBooking();
    $other->update(['status' => BookingStatus::Ongoing, 'assigned_driver_id' => $driver->id,
        'rental_start_at' => now()->subDays(2), 'rental_end_at' => now()->subDay()]);
    Sanctum::actingAs($driver);
    $this->getJson('/api/mobile/driver/services/'.$booking->id)->assertOk()->assertJsonPath('data.driverWorkflow.canReportOnWay', false);
    $this->postJson('/api/mobile/driver/services/'.$booking->id.'/workflow', ['action' => 'on_way'])->assertUnprocessable();
    expect($booking->fresh()->assignment->on_way_at)->toBeNull();
});

it('rejects unsupported workflow actions instead of accepting a general booking status change', function () {
    $booking = pickupWorkflowBooking();
    Sanctum::actingAs($booking->assignedDriver);
    $this->postJson('/api/mobile/driver/services/'.$booking->id.'/workflow', ['action' => 'completed', 'status' => 'completed'])
        ->assertUnprocessable()->assertJsonValidationErrors('action');
    expect($booking->fresh()->status)->toBe(BookingStatus::Confirmed)
        ->and($booking->assignment->arrived_at)->toBeNull();
});

it('renders operational emails with driver contacts and no payment attachments or timezone suffix', function () {
    $mail = new BookingDriverUpdateMail([
        'title' => 'Driver arrived', 'message' => 'Test Driver has arrived at your pickup location.',
        'bookingCode' => 'BK-EMAIL', 'pickupLocation' => 'Test pickup', 'occurredAt' => '2026-11-21T01:00:00Z',
        'driver' => ['name' => 'Test Driver', 'email' => 'driver@example.test', 'phoneNumber' => '09170000883'],
    ]);
    expect($mail->render())->toContain('Test Driver', 'driver@example.test', '09170000883', '9:00 AM')
        ->not->toContain('Asia/Manila', 'UTC+8', 'PHT')
        ->and($mail->attachments)->toBe([]);
});
