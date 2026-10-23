<?php

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Mail\BookingConfirmationMail;
use App\Models\Booking;
use App\Models\BookingPaymentDocument;
use App\Models\Payment;
use App\Services\BookingConfirmationViewData;
use App\Services\BookingEmailService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Storage::fake('local');
    config()->set('mail.booking_confirmations_queue', false);
});

function bookingEmailFixture(array $userAttributes = []): array
{
    $user = customerUser($userAttributes);
    $vehicle = availableVehicle();
    $booking = Booking::create([
        'booking_code' => 'BK-EMAIL-'.Str::upper(Str::random(6)),
        'user_id' => $user->id, 'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->addDays(3), 'rental_end_at' => now()->addDays(4),
        'pickup_location_type' => 'shop', 'pickup_location' => 'Rental office', 'return_location' => 'Rental office',
        'status' => BookingStatus::Confirmed, 'payment_status' => PaymentStatus::Paid,
        'price_per_day' => 3500, 'duration_days' => 1, 'subtotal' => 3500, 'total_amount' => 3500,
        'remaining_balance' => 0, 'terms_accepted_at' => now(),
    ]);
    $payment = Payment::create([
        'booking_id' => $booking->id, 'user_id' => $user->id, 'provider' => 'paypal',
        'purpose' => 'full_payment', 'status' => 'completed', 'amount' => 3500,
        'currency' => 'PHP', 'provider_transaction_id' => 'EXAMPLE-PAYMENT', 'completed_at' => now(),
    ]);

    return [$booking, $payment];
}

it('tracks delivery and retains both issued PDFs after the mail transport succeeds', function () {
    [$booking, $payment] = bookingEmailFixture();

    expect(app(BookingEmailService::class)->sendBookingConfirmation($booking))->toBeTrue();
    $document = BookingPaymentDocument::sole();
    expect($document->payment_id)->toBe($payment->id)
        ->and($document->delivery_status)->toBe('sent')
        ->and($document->sent_at)->not->toBeNull()
        ->and($booking->fresh()->confirmation_email_status)->toBe('sent')
        ->and($booking->fresh()->confirmation_email_error)->toBeNull();
    Storage::disk('local')->assertExists([$document->rental_information_path, $document->receipt_path]);
    $this->assertDatabaseHas('notifications', ['booking_id' => $booking->id, 'title' => 'Rental information and receipt sent']);
});

it('does not send an automatic duplicate for a payment already delivered', function () {
    [$booking] = bookingEmailFixture();
    $service = app(BookingEmailService::class);
    expect($service->sendBookingConfirmation($booking))->toBeTrue()
        ->and($service->sendBookingConfirmation($booking))->toBeFalse()
        ->and(BookingPaymentDocument::count())->toBe(1);
    $this->assertDatabaseCount('notifications', 1);
});

it('queues exactly two attachments using the saved filenames when queue delivery is enabled', function () {
    Mail::fake();
    config()->set('mail.booking_confirmations_queue', true);
    [$booking] = bookingEmailFixture();

    expect(app(BookingEmailService::class)->sendBookingConfirmation($booking))->toBeTrue();
    $document = BookingPaymentDocument::sole();
    Mail::assertQueued(BookingConfirmationMail::class, function (BookingConfirmationMail $mail) use ($document) {
        $attachments = $mail->attachments();

        return $mail->document->is($document) && count($attachments) === 2
            && $attachments[0]->as === $document->rental_information_filename
            && $attachments[1]->as === $document->receipt_filename
            && $mail->hasTo($document->context['customer']['email']);
    });
    expect($booking->fresh()->confirmation_email_status)->toBe('queued');
    Storage::disk('local')->assertExists([$document->rental_information_path, $document->receipt_path]);
});

it('renders matching formal email formats without a card and identifies the individual payment', function () {
    [$booking] = bookingEmailFixture();
    $confirmation = app(BookingConfirmationViewData::class)->make($booking);
    $confirmation['customer']['name'] = 'Example Customer';

    foreach (['confirmation', 'confirmation-text'] as $template) {
        $content = view("emails.bookings.{$template}", compact('confirmation'))->render();
        $text = strip_tags($content);
        expect($text)->toContain('Dear Example Customer,')
            ->toContain('Booking reference: '.$booking->booking_code)
            ->not->toContain('Invoice', 'INV-')->toContain('rental information')
            ->toContain('Receipt reference: RCP-')
            ->toContain('Amount received in this payment: PHP 3,500.00')
            ->toContain('Total paid as of issue: PHP 3,500.00')
            ->toContain('Remaining balance as of issue: PHP 0.00')
            ->toContain('Please review both attached PDFs and retain them for your records.')
            ->toContain('Sincerely,')
            ->and($content)->not->toContain('<table')->not->toContain('background:')->not->toContain('border:');
    }
});

it('records a delivery failure without discarding the issued record when the recipient is missing', function () {
    [$booking] = bookingEmailFixture(['email' => '']);
    expect(app(BookingEmailService::class)->sendBookingConfirmation($booking))->toBeFalse()
        ->and(BookingPaymentDocument::sole()->delivery_status)->toBe('failed');
    $this->assertDatabaseHas('booking_confirmation_emails', ['booking_id' => $booking->id, 'status' => 'failed']);
});

it('provides a development command for testing the configured mail transport', function () {
    expect(Artisan::call('mail:test-resend', ['email' => 'renter@example.com']))->toBe(0);
});
