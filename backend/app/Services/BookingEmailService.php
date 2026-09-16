<?php

namespace App\Services;

use App\Mail\BookingConfirmationMail;
use App\Models\Booking;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class BookingEmailService
{
    public const STATUS_QUEUED = 'queued';

    public const STATUS_SENT = 'sent';

    public const STATUS_FAILED = 'failed';

    public function __construct(
        private readonly BookingConfirmationPdfService $pdfService,
        private readonly NotificationService $notificationService
    ) {}

    public function sendBookingConfirmation(Booking $booking, bool $force = false): bool
    {
        $booking = DB::transaction(function () use ($booking, $force) {
            $lockedBooking = Booking::query()
                ->with(['user.customerProfile', 'vehicle', 'payments', 'confirmationEmail'])
                ->lockForUpdate()
                ->findOrFail($booking->getKey());
            $email = $lockedBooking->confirmationEmail()->firstOrNew([]);

            if (
                ! $force
                && (
                    $email->sent_at !== null
                    || $email->status === self::STATUS_QUEUED
                )
            ) {
                return null;
            }

            if (! $lockedBooking->user?->email) {
                $email->fill([
                    'status' => self::STATUS_FAILED,
                    'error' => 'The renter does not have an email address.',
                ])->save();

                Log::warning('Booking confirmation email was not queued because the renter has no email address.', [
                    'booking_id' => $lockedBooking->id,
                    'customer_email' => null,
                ]);

                return null;
            }

            $email->fill([
                'sent_at' => null,
                'status' => self::STATUS_QUEUED,
                'error' => null,
            ])->save();

            return $lockedBooking;
        });

        if (! $booking) {
            return false;
        }

        $pdfPath = sprintf(
            'booking-confirmations/%s/%s.pdf',
            $booking->getKey(),
            Str::uuid()
        );

        try {
            $pdfBinary = $this->pdfService->render($booking);

            if (! Storage::disk('local')->put($pdfPath, $pdfBinary)) {
                throw new RuntimeException('The booking confirmation PDF could not be stored.');
            }

            $mail = (new BookingConfirmationMail($booking, $pdfPath))->afterCommit();
            $pendingMail = Mail::to($booking->user->email);

            if (config('mail.booking_confirmations_queue')) {
                $pendingMail->queue($mail);
            } else {
                $pendingMail->sendNow($mail);
            }

            return true;
        } catch (Throwable $exception) {
            Storage::disk('local')->delete($pdfPath);
            $this->markFailed($booking, $exception);

            return false;
        }
    }

    public function markSent(Booking $booking, ?string $messageId = null): void
    {
        $booking = Booking::query()->with(['user', 'confirmationEmail'])->find($booking->getKey());

        if (! $booking) {
            return;
        }

        $booking->confirmationEmail()->updateOrCreate([], [
            'sent_at' => now(),
            'status' => self::STATUS_SENT,
            'error' => null,
        ]);

        $this->notificationService->createForBooking(
            $booking,
            'booking',
            'Booking confirmation sent',
            'Your official PDF booking confirmation was sent to your email. Print it and present it to the Jamjade owner or administrator before vehicle release.',
            [
                'priority' => 'success',
                'action_label' => 'View Booking',
                'action' => 'view_booking',
                'email' => $booking->user?->email,
                'print_required' => true,
            ]
        );

        Log::info('Booking confirmation email sent.', [
            'booking_id' => $booking->id,
            'customer_email' => $booking->user?->email,
            'smtp_message_id' => $messageId,
        ]);
    }

    public function markFailed(Booking $booking, Throwable|string $error): void
    {
        $booking = Booking::query()->with(['user', 'confirmationEmail'])->find($booking->getKey());

        if (! $booking) {
            return;
        }

        $message = $this->safeErrorMessage(
            $error instanceof Throwable ? $error->getMessage() : $error
        );

        $booking->confirmationEmail()->updateOrCreate([], [
            'status' => self::STATUS_FAILED,
            'error' => $message,
        ]);

        Log::error('Booking confirmation email failed.', [
            'booking_id' => $booking->id,
            'customer_email' => $booking->user?->email,
            'error' => $message,
        ]);
    }

    public function deleteTemporaryPdf(?string $path): void
    {
        if ($path) {
            Storage::disk('local')->delete($path);
        }
    }

    private function safeErrorMessage(string $message): string
    {
        $message = preg_replace('/\bre_[A-Za-z0-9_-]+\b/', '[redacted]', $message) ?? $message;

        return Str::limit($message, 2000, '...');
    }
}
