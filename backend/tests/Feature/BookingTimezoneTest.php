<?php

use App\Models\Booking;
use App\Services\BookingService;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Mail::fake();
});

afterEach(fn () => CarbonImmutable::setTestNow());

it('keeps mobile booking times, management displays and inspection eligibility aligned', function (string $start, string $end, string $startUtc, string $endUtc, string $startLabel, string $endLabel) {
    CarbonImmutable::setTestNow(CarbonImmutable::parse($startUtc)->subMinute());
    config(['telematics.handover_test_mode' => false, 'telematics.early_start_test_mode' => false]);
    $customer = customerUser();
    $vehicle = availableVehicle();
    Sanctum::actingAs($customer);
    $response = $this->postJson('/api/mobile/bookings', [
        'vehicle_id' => $vehicle->id,
        'rental_start_at' => $start,
        'rental_end_at' => $end,
        'pickup_location_type' => 'shop',
        'pickup_location' => BookingService::JAMJADE_GARAGE,
        'return_location' => BookingService::JAMJADE_GARAGE,
        'driver_option' => 'self_drive',
        'down_payment_amount' => 3500,
        'payment_method' => 'GCash',
        'transaction_id' => 'TIMEZONE-TEST',
        'customer_signature' => 'Synthetic signature',
        'terms_version' => '2026-06-07',
        'late_return_policy_version' => lateReturnPolicyVersion($vehicle->id),
    ])->assertCreated()
        ->assertJsonPath('data.rentalDate', $startLabel)
        ->assertJsonPath('data.returnDate', $endLabel)
        ->assertJsonPath('data.rentalStartAt', $startUtc)
        ->assertJsonPath('data.rentalEndAt', $endUtc);

    $booking = Booking::findOrFail($response->json('data.backendId'));
    $this->getJson('/api/mobile/bookings/'.$booking->booking_code)
        ->assertOk()->assertJsonPath('data.rentalDate', $startLabel);
    $manager = vehicleManagerUser();
    $this->actingAs($manager)->getJson('/admin/bookings/'.$booking->id)
        ->assertOk()->assertJsonPath('data.rentalDate', $startLabel)
        ->assertJsonPath('data.readiness.outgoingInspectionTimeEligible', CarbonImmutable::parse($start)->subMinute()->isSameDay(CarbonImmutable::parse($start)))
        ->assertJsonPath('data.readiness.rentalPeriodEligible', CarbonImmutable::parse($start)->subMinute()->isSameDay(CarbonImmutable::parse($start)));

    CarbonImmutable::setTestNow(CarbonImmutable::parse($startUtc));
    $this->getJson('/admin/bookings/'.$booking->id)
        ->assertOk()->assertJsonPath('data.readiness.outgoingInspectionTimeEligible', true)
        ->assertJsonPath('data.rentalStartAt', $startUtc);
    $this->getJson('/admin/bookings')->assertOk()->assertJsonPath('data.0.rentalDate', $startLabel);

    CarbonImmutable::setTestNow(CarbonImmutable::parse($endUtc));
    $this->getJson('/admin/bookings/'.$booking->id)
        ->assertOk()->assertJsonPath('data.readiness.outgoingInspectionTimeEligible', false);
    expect($booking->fresh()->rental_start_at->toISOString())->toBe($startUtc)
        ->and($booking->fresh()->rental_end_at->toISOString())->toBe($endUtc);
})->with([
    'evening pickup' => ['2026-10-18T21:25:00+08:00', '2026-10-19T21:25:00+08:00', '2026-10-18T13:25:00.000000Z', '2026-10-19T13:25:00.000000Z', 'Sun, Oct 18, 2026 - 9:25 PM', 'Mon, Oct 19, 2026 - 9:25 PM'],
    'Manila date differs from UTC' => ['2026-10-19T00:25:00+08:00', '2026-10-20T00:25:00+08:00', '2026-10-18T16:25:00.000000Z', '2026-10-19T16:25:00.000000Z', 'Mon, Oct 19, 2026 - 12:25 AM', 'Tue, Oct 20, 2026 - 12:25 AM'],
]);
