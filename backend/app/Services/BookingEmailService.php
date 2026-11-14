<?php

namespace App\Services;

use App\Mail\BookingConfirmationMail;
use App\Models\Booking;
use App\Models\BookingPaymentDocument;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Throwable;

class BookingEmailService
{
    public const STATUS_QUEUED = 'queued';

    public const STATUS_SENT = 'sent';

    public const STATUS_FAILED = 'failed';

    public function __construct(
        private readonly BookingPaymentDocumentService $documents,
        private readonly NotificationService $notificationService,
    ) {}

    public function queueForPayment(Payment $payment): void
    {
        // Capture the financial snapshot inside the payment transaction; delivery starts after commit.
        $document = $this->documents->issue($payment);
        if ($document) {
            DB::afterCommit(fn () => $this->sendDocument($document));
        }
    }

    public function sendBookingConfirmation(Booking $booking, bool $force = false): bool
    {
        $payment = $booking->successfulCustomerPayments()->orderByDesc('completed_at')->orderByDesc('id')->first();
        if (! $payment) {
            return false;
        }

        $document = $this->documents->issue($payment);

        return $document && $this->sendDocument($document, $force);
    }

    public function retryPendingDocuments(bool $includeFailed = false): int
    {
        // Recover issuance committed just before an interrupted after-commit callback.
        $documents = BookingPaymentDocument::query()
            ->whereIn('delivery_status', $includeFailed ? ['pending', self::STATUS_FAILED] : ['pending'])
            ->orderBy('id')->limit(50)->get();

        return $documents->filter(fn (BookingPaymentDocument $document) => $this->sendDocument($document))->count();
    }

    public function sendDocument(BookingPaymentDocument $document, bool $force = false): bool
    {
        $token = null;
        try {
            $claimed = DB::transaction(function () use ($document, $force) {
                $document = BookingPaymentDocument::query()->lockForUpdate()->findOrFail($document->id);
                if ($document->delivery_status === self::STATUS_QUEUED
                    || (! $force && $document->delivery_status === self::STATUS_SENT)) {
                    return null;
                }
                if (empty($document->booking?->user?->email)) {
                    return $document;
                }

                $this->documents->render($document);
                $document->update([
                    'delivery_status' => self::STATUS_QUEUED,
                    'delivery_token' => (string) Str::uuid(),
                    'sent_at' => null,
                    'error' => null,
                ]);

                return $document;
            });
            if (! $claimed) {
                return false;
            }
            $document = $claimed;
            $recipient = $document->booking?->user?->email;
            if (empty($recipient)) {
                $this->markFailed($document, 'The renter does not have an email address.');

                return false;
            }
            $token = $document->delivery_token;
            $this->updateSummary($document);
            $mail = (new BookingConfirmationMail($document, $token))->afterCommit();
            $pendingMail = Mail::to($recipient);
            if (config('mail.booking_confirmations_queue')) {
                $pendingMail->queue($mail);
            } else {
                $pendingMail->sendNow($mail);
            }

            return true;
        } catch (Throwable $exception) {
            $this->markFailed($document, $exception, $token);

            return false;
        }
    }

    public function markSent(BookingPaymentDocument $document, string $token): void
    {
        $document = DB::transaction(function () use ($document, $token) {
            $document = BookingPaymentDocument::query()->lockForUpdate()->findOrFail($document->id);
            if ($document->delivery_token !== $token || $document->delivery_status === self::STATUS_SENT) {
                return null;
            }
            $document->update(['delivery_status' => self::STATUS_SENT, 'sent_at' => now(), 'error' => null]);

            return $document;
        });
        if (! $document) {
            return;
        }
        $this->updateSummary($document);
        $booking = $document->booking;
        if ($booking) {
            $this->notificationService->notifyPaymentDocumentsSent($booking, $document->payment_id, ($document->context['formatVersion'] ?? 1) < 3);
        }
        Log::info('Booking payment documents sent.', ['booking_id' => $document->booking_id, 'document_id' => $document->id]);
    }

    public function markFailed(BookingPaymentDocument $document, Throwable|string $error, ?string $token = null): void
    {
        $updated = DB::transaction(function () use ($document, $error, $token) {
            $document = BookingPaymentDocument::query()->lockForUpdate()->find($document->id);
            if (! $document || $document->delivery_status === self::STATUS_SENT
                || ($token !== null && $document->delivery_token !== $token)
                || ($token === null && $document->delivery_status === self::STATUS_QUEUED)) {
                return null;
            }
            $document->update([
                'delivery_status' => self::STATUS_FAILED,
                'error' => is_string($error) ? $error : 'The booking documents could not be delivered. Check mail and storage configuration before retrying.',
            ]);

            return $document;
        });
        if ($updated) {
            app(OperationalErrorService::class)->record('documents', $updated->booking_id);
            $this->updateSummary($updated);
            Log::error('Booking payment document delivery failed.', [
                'booking_id' => $updated->booking_id, 'document_id' => $updated->id,
                'exception_type' => $error instanceof Throwable ? $error::class : null,
            ]);
        }
    }

    private function updateSummary(BookingPaymentDocument $document): void
    {
        // Preserve the existing API read model, but an older queued message must not replace a newer delivery.
        DB::transaction(function () use ($document) {
            $booking = Booking::query()->lockForUpdate()->find($document->booking_id);
            if (! $booking || BookingPaymentDocument::query()->where('booking_id', $booking->id)->where('id', '>', $document->id)->exists()) {
                return;
            }
            $booking->confirmationEmail()->updateOrCreate([], [
                'sent_at' => $document->sent_at, 'status' => $document->delivery_status, 'error' => $document->error,
            ]);
        });
    }
}
