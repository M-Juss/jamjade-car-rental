<?php

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Mail\BookingConfirmationMail;
use App\Models\Booking;
use App\Models\BookingPaymentDocument;
use App\Models\Payment;
use App\Services\BookingConfirmationPdfService;
use App\Services\BookingConfirmationViewData;
use App\Services\BookingEmailService;
use App\Services\BookingPaymentDocumentService;
use App\Services\PaymentService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Contracts\Mail\Mailer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Mail\PendingMail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Storage::fake('local');
    config()->set('mail.booking_confirmations_queue', false);
});

function paymentDocumentBooking(): Booking
{
    $user = customerUser();

    return Booking::create([
        'booking_code' => 'BK-DOC-'.Str::upper(Str::random(6)),
        'user_id' => $user->id, 'vehicle_id' => availableVehicle()->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->addDays(3), 'rental_end_at' => now()->addDays(4),
        'pickup_location_type' => 'shop', 'pickup_location' => 'Rental office', 'return_location' => 'Rental office',
        'status' => BookingStatus::Confirmed, 'payment_status' => PaymentStatus::Partial,
        'price_per_day' => 3500, 'duration_days' => 1, 'subtotal' => 3500,
        'total_amount' => 3500, 'remaining_balance' => 2500,
        'terms_accepted_at' => now(), 'terms_version' => '2026-10-12',
    ]);
}

function documentPayment(Booking $booking, array $overrides = []): Payment
{
    return Payment::create(array_merge([
        'booking_id' => $booking->id, 'user_id' => $booking->user_id,
        'provider' => 'paypal', 'purpose' => 'down_payment', 'status' => 'completed',
        'amount' => 1000, 'currency' => 'PHP', 'completed_at' => now(),
        'provider_transaction_id' => 'EXAMPLE-'.Str::upper(Str::random(6)),
    ], $overrides));
}

it('issues references with at least five digits without truncating larger payment numbers', function (int $paymentId, string $number) {
    $booking = paymentDocumentBooking();
    $payment = Payment::unguarded(fn () => documentPayment($booking, ['id' => $paymentId]));
    $document = app(BookingPaymentDocumentService::class)->issue($payment);
    $confirmation = $document->context;

    expect($confirmation)->not->toHaveKeys(['invoiceReference', 'invoiceSnapshot', 'invoiceSourceDocumentId'])
        ->and($confirmation['receipt']['reference'])->toBe('RCP-'.$number)
        ->and($document->receipt_filename)->toEndWith("Receipt-RCP-{$number}.pdf")
        ->and(view('pdf.bookings.rental-information', compact('confirmation'))->render())->toContain('RCP-'.$number)->not->toContain('Invoice', 'INV-')
        ->and(view('pdf.bookings.payment-receipt', compact('confirmation'))->render())->toContain('RCP-'.$number)->not->toContain('Invoice', 'INV-');
})->with([
    'padded number' => [123, '00123'],
    'five digit boundary' => [99999, '99999'],
    'six digit number' => [100000, '100000'],
]);

it('preserves historical invoice bytes while later payments issue independent receipt documents', function () {
    $booking = paymentDocumentBooking();
    $firstPayment = documentPayment($booking);
    $context = app(BookingConfirmationViewData::class)->make($booking, payment: $firstPayment);
    $context['formatVersion'] = 1;
    $context['invoiceReference'] = sprintf('INV-%08d', $firstPayment->id);
    $context['receipt']['reference'] = sprintf('RCP-%08d', $firstPayment->id);
    $first = BookingPaymentDocument::create([
        'booking_id' => $booking->id, 'payment_id' => $firstPayment->id,
        'issued_at' => now(), 'context' => $context,
        'rental_information_path' => "booking-documents/{$booking->id}/invoice.pdf",
        'receipt_path' => "booking-documents/{$booking->id}/{$firstPayment->id}/receipt.pdf",
        'rental_information_filename' => $booking->booking_code.' | Invoice.pdf',
        'receipt_filename' => $booking->booking_code.' | Confirmed | Receipt-'.$context['receipt']['reference'].'.pdf',
    ]);
    $original = $first->context;
    Storage::disk('local')->put($first->rental_information_path, '%PDF-1.4 retained invoice');
    Storage::disk('local')->put($first->receipt_path, '%PDF-1.4 retained receipt');
    $service = app(BookingPaymentDocumentService::class);
    $reissued = $service->issue($firstPayment);
    $nextPayment = documentPayment($booking, ['purpose' => 'remaining_balance', 'amount' => 2500]);
    $next = $service->issue($nextPayment);

    expect($reissued->id)->toBe($first->id)
        ->and($first->fresh()->context)->toBe($original)
        ->and($reissued->receipt_filename)->toBe($first->receipt_filename)
        ->and($next->context)->not->toHaveKey('invoiceReference')
        ->and($next->context['receipt']['reference'])->toBe(sprintf('RCP-%05d', $nextPayment->id))
        ->and($next->rental_information_path)->not->toBe($first->rental_information_path)
        ->and($next->rental_information_filename)->toContain('Rental Information-RCP-')
        ->and(Storage::disk('local')->get($first->rental_information_path))->toBe('%PDF-1.4 retained invoice')
        ->and(Storage::disk('local')->get($first->receipt_path))->toBe('%PDF-1.4 retained receipt')
        ->and(BookingPaymentDocument::count())->toBe(2);
});

it('renders rental information and a separate one-page receipt for the individual payment', function () {
    $booking = paymentDocumentBooking();
    $payment = documentPayment($booking);
    $document = app(BookingPaymentDocumentService::class)->issue($payment);
    $confirmation = $document->context;
    $pdf = app(BookingConfirmationPdfService::class);
    $information = $pdf->makeRentalInformation($confirmation);
    $receipt = $pdf->makeReceipt($confirmation);
    $informationHtml = view('pdf.bookings.rental-information', compact('confirmation'))->render();
    $receiptHtml = view('pdf.bookings.payment-receipt', compact('confirmation'))->render();

    expect($information->getDomPDF()->getCanvas()->get_page_count())->toBe(2)
        ->and($receipt->getDomPDF()->getCanvas()->get_page_count())->toBe(1)
        ->and($information->output())->toContain('/BaseFont /NotoSans-Regular')
        ->and($receipt->output())->toContain('/BaseFont /NotoSans-Bold')
        ->and($informationHtml)->toContain('Rental Information', 'General Terms and Conditions', 'RENTER ACKNOWLEDGEMENT', 'PHP 3,500.00', 'PHP 1,000.00', 'PHP 2,500.00')->not->toContain('Invoice', 'INV-')
        ->and($receiptHtml)->toContain('Payment Receipt', 'Amount Received in This Payment', 'PHP 1,000.00', 'PHP 2,500.00', 'Down Payment')
        ->not->toContain('General Terms and Conditions')
        ->and($document->receipt_filename)->toContain(' | Confirmed | Receipt-RCP-')
        ->and(DB::table('booking_payment_documents')->value('context'))->not->toContain($booking->user->email);
});

it('finishes a pending historical document pair using its original invoice format', function () {
    $booking = paymentDocumentBooking();
    $payment = documentPayment($booking);
    $context = app(BookingConfirmationViewData::class)->make($booking, payment: $payment);
    $context['formatVersion'] = 2;
    $context['invoiceReference'] = 'INV-HISTORICAL';
    $context['invoiceSnapshot'] = $context;
    unset($context['invoiceSnapshot']['receipt']);
    $legacy = BookingPaymentDocument::create([
        'booking_id' => $booking->id, 'payment_id' => $payment->id, 'issued_at' => now(), 'context' => $context,
        'rental_information_path' => "booking-documents/{$booking->id}/invoice.pdf",
        'receipt_path' => "booking-documents/{$booking->id}/{$payment->id}/receipt.pdf",
        'rental_information_filename' => $booking->booking_code.' | Invoice.pdf',
        'receipt_filename' => $booking->booking_code.' | Receipt.pdf',
    ]);
    $original = $legacy->fresh()->context;
    app(BookingPaymentDocumentService::class)->render($legacy);
    Storage::disk('local')->assertExists([$legacy->rental_information_path, $legacy->receipt_path]);
    expect($legacy->fresh()->context)->toBe($original)
        ->and(view('pdf.bookings.legacy-invoice', ['confirmation' => $context])->render())->toContain('Invoice', 'INV-HISTORICAL')
        ->and((new BookingConfirmationMail($legacy, 'pending'))->envelope()->subject)->toContain('Invoice and Payment Receipt');
});

it('counts only completed customer payments and itemizes only customer-responsible charges', function () {
    $booking = paymentDocumentBooking();
    $customerPayment = documentPayment($booking);
    foreach (['pending', 'failed', 'refunded'] as $status) {
        documentPayment($booking, ['status' => $status, 'amount' => 9000]);
    }
    $driver = createDriverUser();
    documentPayment($booking, ['user_id' => $driver->id, 'purpose' => 'driver_outstanding', 'amount' => 9000]);
    documentPayment($booking, ['purpose' => 'driver_outstanding', 'amount' => 9000]);
    $booking->additionalCharges()->create([
        'type' => 'vehicle_damage', 'description' => 'Customer charge example', 'amount' => 300,
        'responsibility' => 'customer', 'responsible_user_id' => $booking->user_id, 'created_by' => $driver->id,
    ]);
    $booking->additionalCharges()->create([
        'type' => 'toll_fee', 'description' => 'Private Driver charge', 'amount' => 800,
        'responsibility' => 'driver', 'responsible_user_id' => $driver->id, 'created_by' => $driver->id,
    ]);
    $booking->update(['total_amount' => 3800, 'payment_status' => PaymentStatus::Paid]);
    $confirmation = app(BookingConfirmationViewData::class)->make($booking->fresh(), payment: $customerPayment);
    $information = view('pdf.bookings.rental-information', compact('confirmation'))->render();

    expect($confirmation['payment']['amountPaid'])->toBe(1000.0)
        ->and($confirmation['payment']['remainingBalance'])->toBe(2800.0)
        ->and($confirmation['paymentStatusLabel'])->toBe('Partially Paid')
        ->and($confirmation['receipt']['amount'])->toBe(1000.0)
        ->and(array_sum(array_column($confirmation['payment']['items'], 'amount')))->toBe(3800.0)
        ->and($information)->toContain('Customer charge example')->not->toContain('Private Driver charge');
});

it('sends a new pair for a balance payment after the first receipt was already sent', function () {
    $booking = paymentDocumentBooking();
    $firstPayment = documentPayment($booking);
    $service = app(BookingEmailService::class);
    expect($service->sendBookingConfirmation($booking))->toBeTrue();
    $first = BookingPaymentDocument::sole();
    $firstBytes = Storage::disk('local')->get($first->receipt_path);
    $firstInformationBytes = Storage::disk('local')->get($first->rental_information_path);

    app(PaymentService::class)->record($booking, $booking->user, [
        'amount' => 2500, 'payment_method' => 'GCash', 'transaction_id' => 'EXAMPLE-BALANCE',
    ]);
    $last = BookingPaymentDocument::latest('id')->first();

    expect(BookingPaymentDocument::count())->toBe(2)
        ->and($first->fresh()->delivery_status)->toBe('sent')
        ->and($last->delivery_status)->toBe('sent')
        ->and($last->payment_id)->not->toBe($firstPayment->id)
        ->and($last->context['receipt']['amount'])->toBe(2500)
        ->and($last->context['payment']['amountPaid'])->toBe(3500)
        ->and($last->context['payment']['remainingBalance'])->toBe(0)
        ->and($last->rental_information_path)->not->toBe($first->rental_information_path)
        ->and($last->rental_information_filename)->toContain($last->context['receipt']['reference'])
        ->and($first->context['payment']['remainingBalance'])->toBe(2500)
        ->and(Storage::disk('local')->get($first->receipt_path))->toBe($firstBytes)
        ->and(Storage::disk('local')->get($first->rental_information_path))->toBe($firstInformationBytes);
    $confirmation = $last->context;
    $information = view('pdf.bookings.rental-information', compact('confirmation'))->render();
    $receipt = view('pdf.bookings.payment-receipt', compact('confirmation'))->render();
    foreach ([$information, $receipt] as $html) {
        expect($html)->toContain($confirmation['receipt']['reference'], 'PHP 2,500.00', 'PHP 3,500.00', 'PHP 0.00')
            ->not->toContain('Invoice', 'INV-');
    }
});

it('keeps accepted pricing separate from later customer charges in both documents', function () {
    $booking = paymentDocumentBooking();
    $documents = app(BookingPaymentDocumentService::class);
    $first = $documents->issue(documentPayment($booking));
    $booking->additionalCharges()->create([
        'type' => 'toll_fee', 'description' => 'Later toll charge', 'amount' => 300,
        'responsibility' => 'customer', 'responsible_user_id' => $booking->user_id, 'created_by' => $booking->user_id,
    ]);
    $booking->update(['total_amount' => 3800]);
    $last = $documents->issue(documentPayment($booking, ['amount' => 2800, 'purpose' => 'customer_outstanding']));
    $confirmation = $last->context;
    expect($confirmation['agreedRentalTotal'])->toEqual(3500)
        ->and($confirmation['rentalSnapshot']['payment'])->toBe($first->context['rentalSnapshot']['payment'])
        ->and($confirmation['payment']['totalAmount'])->toEqual(3800)
        ->and($confirmation['payment']['remainingBalance'])->toEqual(0);
    foreach (['rental-information', 'payment-receipt'] as $view) {
        $html = view('pdf.bookings.'.$view, compact('confirmation'))->render();
        expect(substr_count($html, 'Later toll charge'))->toBe(1)
            ->and($html)->toContain('PHP 3,500.00', 'PHP 3,800.00', 'PHP 2,800.00', 'PHP 0.00');
    }
});

it('renames document metadata reversibly without rewriting encrypted contexts or private paths', function () {
    $booking = paymentDocumentBooking();
    $document = app(BookingPaymentDocumentService::class)->issue(documentPayment($booking));
    $booking->terms->update(['rental_context' => $document->context['rentalSnapshot']]);
    $termsCiphertext = DB::table('booking_terms')->where('booking_id', $booking->id)->value('rental_context');
    $before = DB::table('booking_payment_documents')->where('id', $document->id)->first();
    $migration = require database_path('migrations/2026_10_19_000004_rename_rental_document_metadata.php');
    $migration->down();
    $legacy = DB::table('booking_payment_documents')->where('id', $document->id)->first();
    expect($legacy->invoice_path)->toBe($before->rental_information_path)
        ->and($legacy->invoice_filename)->toBe($before->rental_information_filename)
        ->and($legacy->context)->toBe($before->context)
        ->and(DB::table('booking_terms')->where('booking_id', $booking->id)->value('invoice_context'))->toBe($termsCiphertext);
    $migration->up();
    expect(DB::table('booking_payment_documents')->where('id', $document->id)->first())->toEqual($before)
        ->and($document->fresh()->context)->toBe($document->context)
        ->and(DB::table('booking_terms')->where('booking_id', $booking->id)->value('rental_context'))->toBe($termsCiphertext);
});

it('resends original references dates amounts and PDF bytes to the current account address', function () {
    $booking = paymentDocumentBooking();
    documentPayment($booking);
    $service = app(BookingEmailService::class);
    $service->sendBookingConfirmation($booking);
    $document = BookingPaymentDocument::sole();
    $original = $document->context;
    $informationBytes = Storage::disk('local')->get($document->rental_information_path);
    $receiptBytes = Storage::disk('local')->get($document->receipt_path);
    $booking->update(['status' => BookingStatus::Ongoing, 'total_amount' => 5000]);
    $booking->user->customerProfile->update(['first_name' => 'Changed']);
    $booking->user->update(['email' => 'updated@example.invalid']);
    $booking->vehicle->update(['name' => 'Changed vehicle']);
    $this->travel(1)->days();
    Mail::fake();

    expect($service->sendBookingConfirmation($booking->fresh(), force: true))->toBeTrue();
    Mail::assertSent(BookingConfirmationMail::class, function (BookingConfirmationMail $mail) use ($original) {
        $rehydrated = unserialize(serialize($mail));

        return $mail->hasTo('updated@example.invalid') && $rehydrated->document->context === $original
            && str_contains($rehydrated->render(), 'PHP 2,500.00')
            && ! str_contains($rehydrated->render(), 'Changed');
    });
    expect(BookingPaymentDocument::count())->toBe(1)
        ->and($document->fresh()->context)->toBe($original)
        ->and(Storage::disk('local')->get($document->rental_information_path))->toBe($informationBytes)
        ->and(Storage::disk('local')->get($document->receipt_path))->toBe($receiptBytes);
});

it('does not issue a receipt for incomplete refunded or Driver payments', function (array $attributes) {
    Mail::fake();
    $booking = paymentDocumentBooking();
    $payment = documentPayment($booking, $attributes);
    app(BookingEmailService::class)->queueForPayment($payment);

    expect(BookingPaymentDocument::count())->toBe(0);
    Mail::assertNothingOutgoing();
})->with([
    'pending' => [['status' => 'pending']],
    'failed' => [['status' => 'failed']],
    'refunded' => [['status' => 'refunded']],
    'Driver purpose' => [['purpose' => 'driver_outstanding']],
    'zero payment' => [['amount' => 0]],
    'foreign currency' => [['currency' => 'USD']],
]);

it('does not send or retain a document when the payment transaction rolls back', function () {
    Mail::fake();
    $booking = paymentDocumentBooking();
    $payment = documentPayment($booking);
    try {
        DB::transaction(function () use ($payment) {
            app(BookingEmailService::class)->queueForPayment($payment);
            throw new RuntimeException('Example rollback');
        });
    } catch (RuntimeException) {
        // The intended rollback must also remove issuance and its delivery callback.
    }
    expect(BookingPaymentDocument::count())->toBe(0);
    Mail::assertNothingOutgoing();
});

it('keeps one issued reference when document generation fails and is retried', function () {
    $booking = paymentDocumentBooking();
    $payment = documentPayment($booking);
    $document = app(BookingPaymentDocumentService::class)->issue($payment);
    $original = $document->context;
    $failingPdf = Mockery::mock(BookingConfirmationPdfService::class);
    $failingPdf->shouldReceive('makeRentalInformation')->once()->andThrow(new RuntimeException('Example rendering failure'));
    app()->instance(BookingConfirmationPdfService::class, $failingPdf);
    expect(app(BookingEmailService::class)->sendDocument($document))->toBeFalse()
        ->and($document->fresh()->delivery_status)->toBe('failed');
    $this->assertDatabaseHas('operational_errors', ['category' => 'documents', 'booking_id' => $booking->id]);

    app()->forgetInstance(BookingConfirmationPdfService::class);
    expect(app(BookingEmailService::class)->sendDocument($document))->toBeTrue()
        ->and($document->fresh()->delivery_status)->toBe('sent')
        ->and($document->fresh()->context)->toBe($original)
        ->and(BookingPaymentDocument::count())->toBe(1);
});

it('ignores duplicate delivery payloads and stale queue failures after a resend', function () {
    $booking = paymentDocumentBooking();
    documentPayment($booking);
    $service = app(BookingEmailService::class);
    $service->sendBookingConfirmation($booking);
    $document = BookingPaymentDocument::sole();
    $old = new BookingConfirmationMail($document, $document->delivery_token);
    expect($old->send(app('mail.manager')))->toBeNull();
    Mail::fake();
    expect($service->sendDocument($document, true))->toBeTrue();
    $newToken = $document->fresh()->delivery_token;
    $old->failed(new RuntimeException('Stale delivery failure'));
    expect($document->fresh()->delivery_status)->toBe('queued')
        ->and($document->fresh()->delivery_token)->toBe($newToken)
        ->and($old->send(app('mail.manager')))->toBeNull();
});

it('prevents issued financial snapshots from being overwritten', function () {
    $booking = paymentDocumentBooking();
    $document = app(BookingPaymentDocumentService::class)->issue(documentPayment($booking));
    $context = $document->context;
    $changed = $context;
    $changed['receipt']['amount'] = 999;
    expect(fn () => $document->update(['context' => $changed]))->toThrow(LogicException::class)
        ->and($document->fresh()->context)->toBe($context);
});

it('marks transport failure and retries the same PDF pair without exposing the transport error', function () {
    $manager = app('mail.manager');
    $booking = paymentDocumentBooking();
    $payment = documentPayment($booking);
    $transport = Mockery::mock(Mailer::class);
    $transport->shouldReceive('sendNow')->once()->andThrow(new RuntimeException('PRIVATE-TRANSPORT-ERROR'));
    Mail::shouldReceive('to')->once()->with($booking->user->email)
        ->andReturn(new PendingMail($transport));

    expect(app(BookingEmailService::class)->sendBookingConfirmation($booking))->toBeFalse();
    $document = BookingPaymentDocument::sole();
    $bytes = Storage::disk('local')->get($document->receipt_path);
    expect($document->delivery_status)->toBe('failed')
        ->and($document->error)->not->toContain('PRIVATE-TRANSPORT-ERROR');

    Mail::swap($manager);
    Mail::fake();
    expect(app(BookingEmailService::class)->sendDocument($document))->toBeTrue()
        ->and($document->fresh()->delivery_status)->toBe('queued')
        ->and($document->payment_id)->toBe($payment->id)
        ->and(Storage::disk('local')->get($document->receipt_path))->toBe($bytes)
        ->and(BookingPaymentDocument::count())->toBe(1);
});

it('recovers pending deliveries and explicitly retries failed ones without redispatching queued records', function () {
    Mail::fake();
    $booking = paymentDocumentBooking();
    $document = app(BookingPaymentDocumentService::class)->issue(documentPayment($booking));
    $this->artisan('booking-documents:retry')->assertSuccessful();
    expect($document->fresh()->delivery_status)->toBe('queued');
    Mail::assertSentCount(1);
    $this->artisan('booking-documents:retry')->assertSuccessful();
    Mail::assertSentCount(1);
    app(BookingEmailService::class)->markFailed($document, 'Example failure', $document->fresh()->delivery_token);
    $this->artisan('booking-documents:retry')->assertSuccessful();
    Mail::assertSentCount(1);
    $this->artisan('booking-documents:retry', ['--include-failed' => true])->assertSuccessful();
    Mail::assertSentCount(2);
    expect(BookingPaymentDocument::count())->toBe(1);
});

it('does not let an older queued delivery replace the latest booking email summary', function () {
    Mail::fake();
    $booking = paymentDocumentBooking();
    $firstPayment = documentPayment($booking);
    $service = app(BookingEmailService::class);
    $service->sendBookingConfirmation($booking);
    $first = BookingPaymentDocument::sole();
    $secondPayment = documentPayment($booking, ['amount' => 500]);
    $second = app(BookingPaymentDocumentService::class)->issue($secondPayment);
    $service->sendDocument($second);
    $service->markSent($second->fresh(), $second->fresh()->delivery_token);
    $service->markFailed($first, 'Older queued delivery failed', $first->delivery_token);
    expect($booking->fresh()->confirmation_email_status)->toBe('sent')
        ->and($booking->fresh()->confirmation_email_error)->toBeNull()
        ->and($first->fresh()->delivery_status)->toBe('failed');
});

it('uses the current account address when a queued email finally sends', function () {
    $manager = app('mail.manager');
    Mail::fake();
    $booking = paymentDocumentBooking();
    documentPayment($booking);
    app(BookingEmailService::class)->sendBookingConfirmation($booking);
    $mail = null;
    Mail::assertSent(BookingConfirmationMail::class, function (BookingConfirmationMail $queued) use (&$mail) {
        $mail = unserialize(serialize($queued));

        return true;
    });
    $booking->user->update(['email' => 'current@example.invalid']);
    Mail::swap($manager);
    expect($mail->send($manager))->not->toBeNull()
        ->and($mail->hasTo('current@example.invalid'))->toBeTrue()
        ->and($mail->hasTo($mail->document->context['customer']['email']))->toBeFalse();
});

it('requires restoring an issued PDF instead of silently replacing it during a resend', function () {
    $booking = paymentDocumentBooking();
    documentPayment($booking);
    $service = app(BookingEmailService::class);
    $service->sendBookingConfirmation($booking);
    $document = BookingPaymentDocument::sole();
    Storage::disk('local')->delete($document->receipt_path);
    Mail::fake();

    expect($service->sendDocument($document, force: true))->toBeFalse()
        ->and($document->fresh()->delivery_status)->toBe('sent');
    Storage::disk('local')->assertMissing($document->receipt_path);
    Mail::assertNothingOutgoing();
});
