<?php

use App\Enums\BookingStatus;
use App\Enums\VehicleStatus;
use App\Models\Booking;
use App\Models\LateReturnPricingSetting;
use App\Models\Notification;
use App\Models\Payment;
use App\Models\User;
use App\Models\VehicleInspection;
use App\Services\AdditionalChargeService;
use App\Services\BookingAttentionService;
use App\Services\BookingReturnService;
use App\Services\BookingService;
use App\Services\LateReturnPricingService;
use App\Services\ReturnDeadlineService;
use Carbon\Carbon;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    $this->travelTo(Carbon::parse('2026-10-15T12:00:00+08:00')->utc());
});

function lateReturnBooking(int $seats = 5, int $secondsLate = 5401, bool $policy = true): Booking
{
    $vehicle = availableVehicle(['seats' => $seats, 'status' => VehicleStatus::Rented]);
    $booking = Booking::create([
        'booking_code' => 'BK-LATE-'.Str::random(8),
        'user_id' => customerUser()->id, 'vehicle_id' => $vehicle->id,
        'rental_type' => 'self_drive', 'status' => 'ongoing', 'payment_status' => 'paid',
        'rental_start_at' => now()->subDays(3), 'rental_end_at' => now()->subSeconds($secondsLate),
        'pickup_location_type' => 'shop', 'pickup_location' => 'Jamjade Garage', 'return_location' => 'Jamjade Garage',
        'price_per_day' => 3500, 'duration_days' => 1, 'subtotal' => 3500, 'total_amount' => 3500, 'remaining_balance' => 0,
        'started_at' => now()->subDays(3),
    ]);
    $booking->terms()->create([
        'terms_version' => '2026-10-15', 'customer_signature' => 'Signed', 'accepted_at' => now()->subDays(3),
        'late_return_policy' => $policy ? app(LateReturnPricingService::class)->policy($vehicle) : null,
    ]);

    return $booking;
}

function incomingForLateReturn(Booking $booking): void
{
    VehicleInspection::create([
        'vehicle_id' => $booking->vehicle_id, 'booking_id' => $booking->id, 'type' => 'incoming', 'status' => 'finalized',
        'odometer' => 1500, 'fuel_level' => 6, 'created_by' => vehicleManagerUser()->id, 'finalized_at' => now(),
    ]);
}

it('uses the one-hour minimum and strict thirty-minute remainder without daily conversion', function (int $seconds, int $hours) {
    $booking = lateReturnBooking(5, $seconds);
    $estimate = app(BookingReturnService::class)->estimate($booking);
    expect($estimate['billableHours'])->toBe($hours)->and($estimate['estimatedAmount'])->toBe((float) ($hours * 200));
})->with([[0, 0], [1, 1], [1800, 1], [3600, 1], [4800, 1], [5400, 1], [5401, 2], [9000, 2], [9001, 3], [92400, 26]]);

it('prices five seats at the small rate and six seats at the large rate', function () {
    expect(app(BookingReturnService::class)->estimate(lateReturnBooking(5))['estimatedAmount'])->toBe(400.0)
        ->and(app(BookingReturnService::class)->estimate(lateReturnBooking(6))['estimatedAmount'])->toBe(600.0);
});

it('freezes receipt time and agreed pricing while settings and vehicle seats change', function () {
    $booking = lateReturnBooking();
    $actor = vehicleManagerUser();
    $service = app(BookingReturnService::class);
    $service->receive($booking, $actor, now()->toISOString());
    app(LateReturnPricingService::class)->update($actor, ['small_vehicle_hourly_rate' => 250, 'large_vehicle_hourly_rate' => 450]);
    $booking->vehicle->update(['seats' => 8]);
    $this->travel(3)->hours();
    $estimate = $service->estimate($booking->fresh());
    expect($estimate['billableHours'])->toBe(2)->and($estimate['hourlyRate'])->toBe(200)->and($estimate['estimatedAmount'])->toBe(400.0);
    expect(fn () => $service->receive($booking, $actor, now()->toISOString()))->toThrow(ValidationException::class);
});

it('stops charging at physical receipt even when paperwork finishes after the deadline', function () {
    $booking = lateReturnBooking(5, 0);
    app(BookingReturnService::class)->receive($booking, vehicleManagerUser(), now()->toISOString());
    $this->travel(5)->hours();
    expect(app(BookingReturnService::class)->estimate($booking->fresh())['billableHours'])->toBe(0)
        ->and(app(BookingAttentionService::class)->state($booking->fresh())['key'])->toBe('return_processing');
});

it('rejects future receipt, pre-release receipt, and receipt for a confirmed booking', function () {
    $actor = vehicleManagerUser();
    $booking = lateReturnBooking();
    $this->actingAs($actor)->postJson("/admin/bookings/{$booking->id}/receive-vehicle", ['vehicle_received_at' => now()->addMinute()->toISOString()])->assertUnprocessable()->assertJsonValidationErrors('vehicle_received_at');
    $this->postJson("/admin/bookings/{$booking->id}/receive-vehicle", ['vehicle_received_at' => now()->subDays(4)->toISOString()])->assertUnprocessable()->assertJsonValidationErrors('vehicle_received_at');
    $booking->update(['status' => 'confirmed']);
    $this->postJson("/admin/bookings/{$booking->id}/receive-vehicle", ['vehicle_received_at' => now()->toISOString()])->assertUnprocessable();
});

it('approves a late charge once and updates only the approved customer balance', function () {
    $booking = lateReturnBooking();
    $actor = vehicleManagerUser();
    app(BookingReturnService::class)->receive($booking, $actor, now()->toISOString());
    incomingForLateReturn($booking);
    $this->actingAs($actor)->postJson("/admin/bookings/{$booking->id}/review-late-charge", ['amount' => 400, 'responsibility' => 'customer'])->assertOk();
    expect($booking->additionalCharges()->count())->toBe(1)->and($booking->fresh()->total_amount)->toBe('3900.00');
    $this->postJson("/admin/bookings/{$booking->id}/review-late-charge", ['amount' => 400, 'responsibility' => 'customer'])->assertUnprocessable();
    expect($booking->additionalCharges()->count())->toBe(1)->and($booking->fresh()->total_amount)->toBe('3900.00');
});

it('requires a reason for waivers and legacy manual pricing and blocks bypass through generic charges', function () {
    $booking = lateReturnBooking();
    $actor = vehicleManagerUser();
    app(BookingReturnService::class)->receive($booking, $actor, now()->toISOString());
    incomingForLateReturn($booking);
    $this->actingAs($actor);
    verifiedOwnerWrite($this, 'POST', "/admin/bookings/{$booking->id}/review-late-charge", ['amount' => 0, 'responsibility' => 'customer'])->assertUnprocessable()->assertJsonValidationErrors('adjustment_reason');
    $this->postJson("/admin/bookings/{$booking->id}/additional-charges", ['charges' => [['type' => 'late_return', 'description' => 'Bypass', 'amount' => 400]]])->assertUnprocessable();
    verifiedOwnerWrite($this, 'POST', "/admin/bookings/{$booking->id}/review-late-charge", ['amount' => 0, 'responsibility' => 'customer', 'adjustment_reason' => 'Approved business waiver'])->assertOk();
    expect($booking->additionalCharges()->count())->toBe(0)->and($booking->fresh()->returnRecord->approved_late_charge)->toBe('0.00');
    $legacy = lateReturnBooking(5, 5401, false);
    app(BookingReturnService::class)->receive($legacy, $actor, now()->toISOString());
    incomingForLateReturn($legacy);
    expect(app(BookingReturnService::class)->estimate($legacy->fresh())['estimatedAmount'])->toBeNull();
    verifiedOwnerWrite($this, 'POST', "/admin/bookings/{$legacy->id}/review-late-charge", ['amount' => 300, 'responsibility' => 'customer'])->assertUnprocessable()->assertJsonValidationErrors('adjustment_reason');
    verifiedOwnerWrite($this, 'POST', "/admin/bookings/{$legacy->id}/review-late-charge", ['amount' => 300, 'responsibility' => 'customer', 'adjustment_reason' => 'Reviewed original signed agreement'])->assertOk();
});

it('requires late review before closing return charges and preserves vehicle restrictions', function () {
    $booking = lateReturnBooking();
    $actor = vehicleManagerUser();
    incomingForLateReturn($booking);
    expect(fn () => app(AdditionalChargeService::class)->finalizeReview($booking, $actor))->toThrow(ValidationException::class);
    app(BookingReturnService::class)->receive($booking, $actor, now()->toISOString());
    expect(fn () => app(AdditionalChargeService::class)->finalizeReview($booking->fresh(), $actor))->toThrow(ValidationException::class);
    app(BookingReturnService::class)->review($booking, $actor, ['amount' => 400, 'responsibility' => 'customer']);
    app(AdditionalChargeService::class)->finalizeReview($booking, $actor);
    app(BookingService::class)->transition($booking, BookingStatus::Returned, $actor);
    expect($booking->fresh()->status)->toBe(BookingStatus::Returned)->and($booking->vehicle->fresh()->status)->toBe(VehicleStatus::Available);
    expect(fn () => app(BookingService::class)->transition($booking->fresh(), BookingStatus::Completed, $actor))->toThrow(ValidationException::class);
});

it('keeps pricing administrator-only and return operations out of customer and Driver access', function () {
    $booking = lateReturnBooking();
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $this->actingAs($staff)->getJson('/admin/late-return-pricing')->assertForbidden();
    $this->putJson('/admin/late-return-pricing', ['small_vehicle_hourly_rate' => 250, 'large_vehicle_hourly_rate' => 350])->assertForbidden();
    $this->postJson("/admin/bookings/{$booking->id}/receive-vehicle", ['vehicle_received_at' => now()->toISOString()])->assertOk();
    $this->actingAs($booking->user)->postJson("/admin/bookings/{$booking->id}/review-late-charge", ['amount' => 400, 'responsibility' => 'customer'])->assertForbidden();
    $this->actingAs(createDriverUser())->postJson("/admin/bookings/{$booking->id}/return-follow-up", ['note' => 'Unauthorized'])->assertForbidden();
});

it('exposes dynamic pricing and rejects missing or stale acceptance before creating a booking', function () {
    $customer = customerUser();
    $vehicle = availableVehicle();
    $policy = $this->getJson("/api/mobile/vehicles/{$vehicle->id}")->assertOk()->json('data.lateReturnPolicy');
    Sanctum::actingAs($customer);
    $payload = [
        'vehicle_id' => $vehicle->id, 'rental_start_at' => now()->addDays(3)->toISOString(), 'rental_end_at' => now()->addDays(4)->toISOString(),
        'pickup_location_type' => 'shop', 'pickup_location' => 'Jamjade Garage', 'return_location' => 'Jamjade Garage', 'driver_option' => 'self_drive',
        'down_payment_amount' => 3500, 'payment_method' => 'GCash', 'customer_signature' => 'Signed', 'terms_version' => '2026-10-15',
    ];
    $this->postJson('/api/mobile/bookings', $payload)->assertUnprocessable()->assertJsonValidationErrors('late_return_policy_version');
    LateReturnPricingSetting::current()->update(['small_vehicle_hourly_rate' => 250]);
    $this->postJson('/api/mobile/bookings', [...$payload, 'late_return_policy_version' => $policy['version']])->assertUnprocessable()->assertJsonValidationErrors('late_return_policy_version');
    $payload['late_return_policy_version'] = lateReturnPolicyVersion($vehicle->id);
    $response = $this->postJson('/api/mobile/bookings', $payload)->assertCreated()->assertJsonPath('data.lateReturn.hourlyRate', 250);
    $booking = Booking::findOrFail($response->json('data.backendId'));
    LateReturnPricingSetting::current()->update(['small_vehicle_hourly_rate' => 300]);
    expect($booking->terms->late_return_policy['hourlyRate'])->toBe(250);
});

it('shows overdue rentals outside the calendar range and filters the booking attention queue', function () {
    $booking = lateReturnBooking();
    $booking->vehicle->update(['brand' => 'Toyota', 'name' => 'Hiace', 'model' => '2019', 'plate_number' => 'SAMPLE-123']);
    $next = $booking->replicate();
    $next->booking_code = 'BK-NEXT-PICKUP';
    $next->status = 'confirmed';
    $next->rental_start_at = now()->addHours(2);
    $next->rental_end_at = now()->addDays(2);
    $next->save();
    $admin = vehicleManagerUser();
    $this->actingAs($admin)->getJson('/admin/dashboard?start=2026-11-01&end=2026-11-30')->assertOk()
        ->assertJsonPath('data.summary.overdueReturns', 1)->assertJsonPath('data.attentionBookings.0.bookingCode', $booking->booking_code)
        ->assertJsonPath('data.attentionBookings.0.vehicleName', 'Toyota Hiace 2019 · SAMPLE-123')
        ->assertJsonPath('data.attentionBookings.0.upcomingBookings.0.bookingCode', 'BK-NEXT-PICKUP')->assertJsonCount(0, 'data.events');
    $this->getJson('/admin/bookings?attention=overdue_return')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.attention.key', 'overdue_return');
});

it('records follow-up without extending the deadline and keeps staff notes private', function () {
    $booking = lateReturnBooking();
    $originalEnd = $booking->rental_end_at->toISOString();
    $this->actingAs(vehicleManagerUser())->postJson("/admin/bookings/{$booking->id}/return-follow-up", ['note' => 'Customer contacted by staff', 'expected_return_at' => now()->addHour()->toISOString()])->assertOk();
    expect($booking->fresh()->rental_end_at->toISOString())->toBe($originalEnd);
    Sanctum::actingAs($booking->user);
    $this->getJson('/api/mobile/bookings/'.$booking->booking_code)->assertOk()->assertJsonMissingPath('data.returnFollowUps')->assertJsonMissingPath('data.upcomingBookings');
});

it('sends one reminder and one overdue notification and stops after physical receipt', function () {
    $booking = lateReturnBooking(5, -3600);
    $service = app(ReturnDeadlineService::class);
    expect($service->process())->toBe(1)->and($service->process())->toBe(0);
    $this->travel(61)->minutes();
    expect($service->process())->toBe(1)->and($service->process())->toBe(0);
    expect(Notification::where('user_id', $booking->user_id)->where('booking_id', $booking->id)->count())->toBe(2);
    app(BookingReturnService::class)->receive($booking, vehicleManagerUser(), now()->toISOString());
    $this->travel(1)->hours();
    expect($service->process())->toBe(0);
});

it('normalizes offset receipt times and permits a safe identical retry', function () {
    $booking = lateReturnBooking();
    $actor = vehicleManagerUser();
    $service = app(BookingReturnService::class);
    $service->receive($booking, $actor, now('Asia/Manila')->toIso8601String());
    $service->receive($booking, $actor, now()->toISOString());
    expect($service->estimate($booking->fresh())['billableHours'])->toBe(2)
        ->and($booking->events()->where('event_type', 'vehicle_received')->count())->toBe(1);
});

it('reviews an existing legacy charge without duplicating it or changing its balance', function () {
    $booking = lateReturnBooking(5, 5401, false);
    $actor = vehicleManagerUser();
    $charge = $booking->additionalCharges()->create(['type' => 'late_return', 'description' => 'Original agreed late fee', 'amount' => 300, 'responsibility' => 'customer', 'responsible_user_id' => $booking->user_id, 'created_by' => $actor->id]);
    app(BookingReturnService::class)->receive($booking, $actor, now()->toISOString());
    incomingForLateReturn($booking);
    app(BookingReturnService::class)->review($booking, $actor, ['amount' => 300, 'responsibility' => 'customer', 'adjustment_reason' => 'Existing fee reviewed against signed terms']);
    expect($booking->additionalCharges()->count())->toBe(1)->and($booking->fresh()->returnRecord->late_charge_id)->toBe($charge->id)
        ->and($booking->fresh()->total_amount)->toBe('3500.00');
});

it('requires a reason to cancel a missed start and never charges it as a late rental', function () {
    $booking = lateReturnBooking();
    $booking->update(['status' => 'confirmed']);
    $actor = vehicleManagerUser();
    expect(app(BookingAttentionService::class)->state($booking->fresh())['key'])->toBe('not_started');
    expect(app(BookingReturnService::class)->estimate($booking->fresh())['estimatedAmount'])->toBe(0.0);
    $this->actingAs($actor)->postJson("/admin/bookings/{$booking->id}/cancel", [])->assertUnprocessable()->assertJsonValidationErrors('reason');
    $this->postJson("/admin/bookings/{$booking->id}/cancel", ['reason' => 'Confirmed no pickup or release occurred'])->assertOk()->assertJsonPath('data.statusKey', 'cancelled');
});

it('keeps a Driver-responsible late charge separate from Customer money and resources', function () {
    $booking = lateReturnBooking();
    $actor = vehicleManagerUser();
    $driver = createDriverUser();
    $booking->update(['rental_type' => 'owners_driver']);
    $booking->assignment()->create(['driver_id' => $driver->id, 'assigned_at' => now()->subDays(3)]);
    app(BookingReturnService::class)->receive($booking, $actor, now()->toISOString());
    incomingForLateReturn($booking);
    app(BookingReturnService::class)->review($booking, $actor, ['amount' => 400, 'responsibility' => 'driver']);
    expect($booking->fresh()->total_amount)->toBe('3500.00')->and($booking->fresh()->remaining_balance)->toBe('0.00');
    Sanctum::actingAs($booking->user);
    $this->getJson('/api/mobile/bookings/'.$booking->booking_code)->assertOk()->assertJsonCount(0, 'data.additionalCharges')->assertJsonPath('data.lateReturn.approvedAmount', null);
    Sanctum::actingAs($driver);
    $this->getJson('/api/mobile/driver/services/'.$booking->booking_code)->assertOk()->assertJsonCount(1, 'data.additionalCharges')->assertJsonMissingPath('data.lateReturn')->assertJsonPath('data.totalAmount', 0);
});

it('requires the reviewed late charge before atomically finalizing and returning', function () {
    $booking = lateReturnBooking();
    $actor = vehicleManagerUser();
    Payment::create([
        'booking_id' => $booking->id, 'user_id' => $booking->user_id, 'payment_method' => 'PayPal',
        'payment_status' => 'paid', 'amount' => 3500, 'transaction_id' => 'COMBINED-RETURN-'.$booking->id, 'paid_at' => now(),
    ]);
    app(BookingReturnService::class)->receive($booking, $actor, now()->toISOString());
    incomingForLateReturn($booking);
    $this->actingAs($actor)->postJson("/admin/bookings/{$booking->id}/finalize-return")
        ->assertUnprocessable()->assertJsonValidationErrors('booking');
    expect($booking->fresh()->return_charges_finalized_at)->toBeNull()
        ->and($booking->fresh()->status)->toBe(BookingStatus::Ongoing);
    app(BookingReturnService::class)->review($booking, $actor, ['amount' => 400, 'responsibility' => 'customer']);
    $this->postJson("/admin/bookings/{$booking->id}/finalize-return")->assertOk()->assertJsonPath('data.statusKey', 'returned');
    expect($booking->fresh()->return_charges_finalized_at)->not->toBeNull()
        ->and($booking->fresh()->remaining_balance)->toBe('400.00');
});
