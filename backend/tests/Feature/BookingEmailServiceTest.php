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

it('renders branded matching email formats from the payment snapshot', function () {
    [$booking] = bookingEmailFixture();
    $confirmation = app(BookingConfirmationViewData::class)->make($booking);
    $confirmation['customer']['name'] = 'Example Customer';

    $html = view('emails.bookings.confirmation', compact('confirmation'))->render();
    $text = view('emails.bookings.confirmation-text', compact('confirmation'))->render();
    $htmlText = html_entity_decode(strip_tags(preg_replace('/<\/(?:p|td|tr|h1|h2)>/i', "\n", $html)));
    foreach ([$htmlText, $text] as $content) {
        expect($content)->toContain('Booking confirmed')
            ->toContain('Dear Example Customer,')
            ->toContain($booking->booking_code)
            ->toContain('Toyota Vios GR-S')
            ->toContain('Rental dates')
            ->not->toContain('Invoice', 'INV-')
            ->toContain('Receipt reference')
            ->toContain('RCP-')
            ->toContain('Amount received this payment')
            ->toContain('Total paid as of issue')
            ->toContain('Remaining balance as of issue')
            ->toContain('PHP 3,500.00')
            ->toContain('PHP 0.00')
            ->toContain('Your rental information, including the rental agreement, and payment receipt are attached. Please review and keep both PDFs for your records.');
    }
    expect($html)->toContain('background-color: #346EF6')
        ->toContain('max-width: 600px')
        ->toContain('border-radius: 14px')
        ->toContain('background-color: #F1F5FF')
        ->not->toContain('gradient', 'Asia/Manila', 'PHT', 'UTC+8');
});

it('uses a payment title for non-confirmed snapshots and retains legacy invoice references', function () {
    [$booking] = bookingEmailFixture();
    $confirmation = app(BookingConfirmationViewData::class)->make($booking);
    $confirmation['bookingStatusLabel'] = 'Pending';
    $confirmation['formatVersion'] = 2;
    $confirmation['invoiceReference'] = 'INV-HISTORICAL';

    $html = view('emails.bookings.confirmation', compact('confirmation'))->render();
    $text = view('emails.bookings.confirmation-text', compact('confirmation'))->render();
    $htmlText = html_entity_decode(strip_tags(preg_replace('/<\/(?:p|td|tr|h1|h2)>/i', "\n", $html)));
    foreach ([$htmlText, $text] as $content) {
        expect($content)->toContain('Payment received')
            ->toContain('Booking status')
            ->toContain('Pending')
            ->toContain('Invoice reference')
            ->toContain('INV-HISTORICAL');
    }
    expect($html)->toContain('<title>Payment received</title>');
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
