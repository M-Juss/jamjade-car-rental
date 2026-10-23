<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\BookingPaymentDocument;
use App\Models\Payment;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class BookingPaymentDocumentService
{
    public function __construct(
        private readonly BookingConfirmationViewData $viewData,
        private readonly BookingConfirmationPdfService $pdfService,
    ) {}

    public function issue(Payment $payment): ?BookingPaymentDocument
    {
        return DB::transaction(function () use ($payment) {
            $booking = Booking::query()->lockForUpdate()->findOrFail($payment->booking_id);
            $payment = Payment::query()->lockForUpdate()->findOrFail($payment->id);

            if ($payment->booking_id !== $booking->id || $payment->status !== 'completed' || $payment->user_id !== $booking->user_id
                || $payment->currency !== 'PHP'
                || $payment->purpose === 'driver_outstanding' || (float) $payment->amount <= 0) {
                return null;
            }

            $existing = BookingPaymentDocument::query()->where('payment_id', $payment->id)->first();
            if ($existing) {
                return $existing;
            }

            $issuedAt = now();
            $context = $this->viewData->make($booking, $issuedAt, $payment);
            $first = BookingPaymentDocument::query()->where('booking_id', $booking->id)->orderBy('id')->first();
            $firstContext = $first?->context;
            // Historical contexts remain encrypted and unchanged; only project their accepted facts.
            $rental = $this->rentalSnapshot($booking->terms?->rental_context
                ?? $firstContext['rentalSnapshot'] ?? $firstContext['invoiceSnapshot'] ?? $firstContext ?? $context);
            $context = array_replace($context, array_intersect_key($rental, array_flip([
                'customer', 'vehicle', 'rental', 'termsAcceptedAt', 'agreementVersion',
                'signatureImage', 'signatureText', 'lateReturnPolicy', 'currentDeliveryTerms', 'agreementHtml',
            ])));
            $context['rentalSnapshot'] = $rental;
            $context['agreedRentalTotal'] = $rental['payment']['totalAmount'];
            $prefix = $context['bookingReference'].' | '.$context['bookingStatusLabel'];
            $path = "booking-documents/{$booking->id}/{$payment->id}";

            return BookingPaymentDocument::create([
                'booking_id' => $booking->id,
                'payment_id' => $payment->id,
                'issued_at' => $issuedAt,
                'context' => $context,
                'rental_information_path' => "{$path}/rental-information.pdf",
                'receipt_path' => "{$path}/receipt.pdf",
                'rental_information_filename' => "{$prefix} | Rental Information-{$context['receipt']['reference']}.pdf",
                'receipt_filename' => "{$prefix} | Receipt-{$context['receipt']['reference']}.pdf",
            ]);
        });
    }

    public function render(BookingPaymentDocument $document): void
    {
        Cache::lock('booking-rental-information:'.$document->booking_id, 120)->block(5, fn () => $this->renderFiles($document));
    }

    private function renderFiles(BookingPaymentDocument $document): void
    {
        $disk = Storage::disk('local');
        foreach (['rental_information_path' => 'makeRentalInformation', 'receipt_path' => 'makeReceipt'] as $field => $method) {
            // A resend reuses the original bytes, not current booking or payment values.
            if (! $disk->exists($document->{$field})) {
                $source = $field === 'rental_information_path' && ($document->context['invoiceSourceDocumentId'] ?? null)
                    ? BookingPaymentDocument::findOrFail($document->context['invoiceSourceDocumentId']) : $document;
                if ($document->delivery_token !== null || $source->delivery_token !== null) {
                    throw new RuntimeException('An issued document is missing. Restore its private storage copy before retrying delivery.');
                }
                $pdf = $this->pdfService->{$method}($source->context);
                $binary = $pdf->output();
                unset($pdf);
                // Dompdf frame trees contain cycles; release each before rendering the next PDF.
                gc_collect_cycles();
                if (! $disk->put($document->{$field}, $binary)) {
                    throw new RuntimeException('The booking document could not be stored.');
                }
            }
        }
    }

    private function rentalSnapshot(array $source): array
    {
        // Old snapshots can include charges already present at issuance. Keep those out of
        // agreed rental pricing because the payment snapshot itemizes customer charges separately.
        $items = $source['payment']['items'];
        $includedChargeCents = 0;
        foreach ($source['additionalChargeItems'] ?? [] as $charge) {
            foreach ($items as $key => $item) {
                if ($item['label'] === $charge['label'] && (int) round($item['amount'] * 100) === (int) round($charge['amount'] * 100)) {
                    $includedChargeCents += (int) round($item['amount'] * 100);
                    unset($items[$key]);
                    break;
                }
            }
        }
        $source['payment'] = [
            'totalAmount' => ((int) round($source['payment']['totalAmount'] * 100) - $includedChargeCents) / 100,
            'pricePerDay' => $source['payment']['pricePerDay'], 'items' => array_values($items),
        ];
        $source['formatVersion'] = 3;
        unset($source['invoiceReference'], $source['invoiceSnapshot'], $source['invoiceSourceDocumentId'],
            $source['paymentStatusLabel'], $source['paymentStatusClass'], $source['receipt'], $source['additionalChargeItems']);
        $source['agreementHtml'] ??= view('pdf.bookings.partials.terms-and-conditions', ['confirmation' => $source])->render();

        return $source;
    }
}
