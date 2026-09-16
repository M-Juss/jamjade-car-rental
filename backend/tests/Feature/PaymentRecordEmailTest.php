<?php

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Mail\BookingConfirmationMail;
use App\Models\Booking;
use App\Models\Payment;
use App\Services\PaymentService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
});

function uploadPaymentBooking(array $attributes = []): array
{
    $user = customerUser();
    $vehicle = availableVehicle();
    $booking = Booking::create(array_merge([
        'booking_code' => 'BK-PAY-'.strtoupper(Str::random(6)),
        'user_id' => $user->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->addDays(3),
        'rental_end_at' => now()->addDays(4),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Rent A Car Services',
        'return_location' => 'Jamjade Rent A Car Services',
        'driver_option' => 'self_drive',
        'status' => BookingStatus::Confirmed,
        'payment_status' => PaymentStatus::Partial,
        'price_per_day' => 3500,
        'duration_days' => 1,
        'subtotal' => 3500,
        'total_amount' => 3500,
        'down_payment_amount' => 1500,
        'remaining_balance' => 2000,
        'customer_signature' => 'signed',
        'terms_version' => '2026-08-19',
        'terms_accepted_at' => now(),
        'confirmed_at' => now(),
    ], $attributes));

    Payment::create([
        'booking_id' => $booking->id,
        'user_id' => $user->id,
        'payment_method' => 'GCash',
        'payment_status' => PaymentStatus::Paid,
        'amount' => 1500,
        'transaction_id' => 'GCASH-DOWN-001',
        'paid_at' => now(),
    ]);

    return [$user, $booking];
}

it('queues the confirmation email when an uploaded payment completes the booking', function () {
    Mail::fake();
    Storage::fake('local');

    [$user, $booking] = uploadPaymentBooking();

    app(PaymentService::class)->record($booking, $user, [
        'payment_method' => 'GCash',
        'amount' => 2000,
        'transaction_id' => 'GCASH-BALANCE-001',
    ]);

    expect($booking->fresh()->payment_status)->toBe(PaymentStatus::Paid)
        ->and($booking->fresh()->remaining_balance)->toBe('0.00');

    $this->assertDatabaseHas('booking_confirmation_emails', [
        'booking_id' => $booking->id,
        'status' => 'queued',
        'sent_at' => null,
    ]);

    Mail::assertSent(
        BookingConfirmationMail::class,
        fn (BookingConfirmationMail $mail) => $mail->hasTo($user->email)
    );
});

it('does not queue a confirmation email for a partial uploaded payment', function () {
    Mail::fake();
    Storage::fake('local');

    [$user, $booking] = uploadPaymentBooking();

    app(PaymentService::class)->record($booking, $user, [
        'payment_method' => 'GCash',
        'amount' => 500,
        'transaction_id' => 'GCASH-BALANCE-002',
    ]);

    expect($booking->fresh()->payment_status)->toBe(PaymentStatus::Partial)
        ->and($booking->fresh()->confirmation_email_status)->toBeNull();

    Mail::assertNothingSent();
});
