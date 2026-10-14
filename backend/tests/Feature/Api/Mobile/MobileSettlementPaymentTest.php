<?php

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Models\Booking;
use App\Models\Payment;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
});

it('returns the actual unpaid charge amount and description for settlement', function (float $paid, string $status) {
    $customer = customerUser();
    $booking = Booking::create([
        'booking_code' => 'BK-SETTLEMENT', 'user_id' => $customer->id, 'vehicle_id' => availableVehicle()->id,
        'rental_type' => 'self_drive', 'driver_option' => 'self_drive',
        'rental_start_at' => now()->subDays(3), 'rental_end_at' => now()->subDay(),
        'pickup_location_type' => 'shop', 'pickup_location' => 'JamJade Garage', 'return_location' => 'JamJade Garage',
        'status' => BookingStatus::Returned, 'payment_status' => PaymentStatus::Partial,
        'price_per_day' => 500, 'duration_days' => 2, 'subtotal' => 1000,
        'down_payment_amount' => 1000, 'total_amount' => 1100, 'remaining_balance' => 100 - $paid,
        'balance_due_at' => now()->subDays(4),
    ]);
    Payment::create([
        'booking_id' => $booking->id, 'user_id' => $customer->id, 'provider' => 'paypal',
        'purpose' => 'full_payment', 'status' => 'completed', 'amount' => 1000, 'completed_at' => now()->subDays(3),
    ]);
    $charge = $booking->additionalCharges()->create([
        'type' => 'cleaning', 'description' => 'Interior cleaning after return.', 'amount' => 100,
        'responsibility' => 'customer', 'responsible_user_id' => $customer->id, 'created_by' => vehicleManagerUser()->id,
    ]);
    if ($paid > 0) {
        $payment = Payment::create([
            'booking_id' => $booking->id, 'user_id' => $customer->id, 'provider' => 'paypal',
            'purpose' => 'remaining_balance', 'status' => 'completed', 'amount' => $paid, 'completed_at' => now(),
        ]);
        $payment->additionalCharges()->attach($charge->id, ['amount' => $paid]);
    }
    // Pending payment allocations must not reduce the amount still owed.
    $pending = Payment::create([
        'booking_id' => $booking->id, 'user_id' => $customer->id, 'provider' => 'paypal',
        'purpose' => 'remaining_balance', 'status' => 'pending', 'amount' => 25,
    ]);
    $pending->additionalCharges()->attach($charge->id, ['amount' => 25]);
    $booking->additionalCharges()->create([
        'type' => 'other', 'description' => 'Another operator charge.', 'amount' => 500,
        'responsibility' => 'driver', 'responsible_user_id' => createDriverUser()->id, 'created_by' => $charge->created_by,
    ]);

    Sanctum::actingAs($customer);
    $this->getJson('/api/mobile/bookings/'.$booking->booking_code)
        ->assertOk()
        ->assertJsonCount(1, 'data.additionalCharges')
        ->assertJsonPath('data.additionalCharges.0.description', 'Interior cleaning after return.')
        ->assertJsonPath('data.additionalCharges.0.amount', 100)
        ->assertJsonPath('data.additionalCharges.0.outstandingAmount', fn ($amount) => (float) $amount === 100 - $paid)
        ->assertJsonPath('data.additionalCharges.0.paymentStatus', $status);
    Sanctum::actingAs(customerUser());
    $this->getJson('/api/mobile/bookings/'.$booking->booking_code)->assertNotFound();
})->with([
    'unpaid' => [0.0, 'unpaid'],
    'partially paid' => [35.0, 'partial'],
    'partially paid with centavos' => [35.25, 'partial'],
    'fully paid' => [100.0, 'paid'],
]);
