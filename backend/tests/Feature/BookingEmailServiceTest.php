<?php

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Mail\BookingConfirmationMail;
use App\Models\Booking;
use App\Models\Payment;
use App\Services\BookingEmailService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Storage::fake('local');
    config()->set('mail.booking_confirmations_queue', false);
});

it('marks a queued booking confirmation as sent after the mail transport succeeds', function () {
    $user = customerUser();
    $vehicle = availableVehicle();
    $booking = Booking::create([
        'booking_code' => 'BK-EMAIL-1',
        'user_id' => $user->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->addDays(3),
        'rental_end_at' => now()->addDays(4),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Garage',
        'return_location' => 'Jamjade Garage',
        'driver_option' => 'self_drive',
        'status' => BookingStatus::Confirmed,
        'payment_status' => PaymentStatus::Paid,
        'price_per_day' => 3500,
        'duration_days' => 1,
        'subtotal' => 3500,
        'down_payment_amount' => 3500,
        'remaining_balance' => 0,
        'total_amount' => 3500,
        'terms_accepted_at' => now(),
    ]);
    Payment::create([
        'booking_id' => $booking->id,
        'user_id' => $user->id,
        'payment_method' => 'PayPal',
        'payment_status' => PaymentStatus::Paid,
        'amount' => 3500,
        'transaction_id' => 'PAYPAL-EMAIL-TEST',
        'paid_at' => now(),
    ]);

    expect(app(BookingEmailService::class)->sendBookingConfirmation($booking))->toBeTrue();

    $booking->refresh();

    expect($booking->confirmation_email_status)->toBe(BookingEmailService::STATUS_SENT)
        ->and($booking->confirmation_email_sent_at)->not->toBeNull()
        ->and($booking->confirmation_email_error)->toBeNull();

    $this->assertDatabaseHas('notifications', [
        'booking_id' => $booking->id,
        'title' => 'Booking confirmation sent',
    ]);

    expect(Storage::disk('local')->allFiles('booking-confirmations'))->toBe([]);
});

it('does not queue an automatic duplicate after confirmation was sent', function () {
    $user = customerUser();
    $vehicle = availableVehicle();
    $booking = Booking::create([
        'booking_code' => 'BK-EMAIL-2',
        'user_id' => $user->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->addDays(3),
        'rental_end_at' => now()->addDays(4),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Garage',
        'return_location' => 'Jamjade Garage',
        'driver_option' => 'self_drive',
        'status' => BookingStatus::Confirmed,
        'payment_status' => PaymentStatus::Partial,
        'price_per_day' => 3500,
        'duration_days' => 1,
        'subtotal' => 3500,
        'down_payment_amount' => 1050,
        'remaining_balance' => 2450,
        'total_amount' => 3500,
        'confirmation_email_sent_at' => now(),
        'confirmation_email_status' => BookingEmailService::STATUS_SENT,
    ]);

    expect(app(BookingEmailService::class)->sendBookingConfirmation($booking))->toBeFalse()
        ->and(Storage::disk('local')->allFiles('booking-confirmations'))->toBe([]);
});

it('can queue booking confirmations when production queue delivery is enabled', function () {
    Mail::fake();
    config()->set('mail.booking_confirmations_queue', true);

    $user = customerUser();
    $vehicle = availableVehicle();
    $booking = Booking::create([
        'booking_code' => 'BK-EMAIL-QUEUED',
        'user_id' => $user->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->addDays(3),
        'rental_end_at' => now()->addDays(4),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Garage',
        'return_location' => 'Jamjade Garage',
        'driver_option' => 'self_drive',
        'status' => BookingStatus::Confirmed,
        'payment_status' => PaymentStatus::Paid,
        'price_per_day' => 3500,
        'duration_days' => 1,
        'subtotal' => 3500,
        'down_payment_amount' => 3500,
        'remaining_balance' => 0,
        'total_amount' => 3500,
        'terms_accepted_at' => now(),
    ]);

    expect(app(BookingEmailService::class)->sendBookingConfirmation($booking))->toBeTrue();

    Mail::assertQueued(
        BookingConfirmationMail::class,
        fn (BookingConfirmationMail $mail) => $mail->booking->is($booking)
    );

    expect($booking->fresh()->confirmation_email_status)
        ->toBe(BookingEmailService::STATUS_QUEUED);
});

it('records a failure when a booking has no renter email address', function () {
    $user = customerUser(['email' => '']);
    $vehicle = availableVehicle();
    $booking = Booking::create([
        'booking_code' => 'BK-EMAIL-3',
        'user_id' => $user->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->addDays(3),
        'rental_end_at' => now()->addDays(4),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Garage',
        'return_location' => 'Jamjade Garage',
        'driver_option' => 'self_drive',
        'status' => BookingStatus::Confirmed,
        'payment_status' => PaymentStatus::Paid,
        'price_per_day' => 3500,
        'duration_days' => 1,
        'subtotal' => 3500,
        'down_payment_amount' => 3500,
        'remaining_balance' => 0,
        'total_amount' => 3500,
    ]);

    expect(app(BookingEmailService::class)->sendBookingConfirmation($booking))->toBeFalse();

    $this->assertDatabaseHas('bookings', [
        'id' => $booking->id,
        'confirmation_email_status' => BookingEmailService::STATUS_FAILED,
    ]);
});

it('provides a development command for testing the configured mail transport', function () {
    expect(Artisan::call('mail:test-resend', [
        'email' => 'renter@example.com',
    ]))->toBe(0);
});
