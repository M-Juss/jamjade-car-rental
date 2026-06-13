<?php

namespace App\Mail;

use App\Models\Booking;
use App\Services\BookingConfirmationPdfService;
use App\Services\BookingConfirmationViewData;
use App\Services\BookingEmailService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Attachment;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class BookingConfirmationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(
        public Booking $booking,
        public string $pdfPath
    ) {}

    public function envelope(): Envelope
    {
        $reference = $this->booking->booking_code ?: (string) $this->booking->getKey();

        return new Envelope(
            from: new Address(
                config('mail.from.address'),
                config('mail.from.name', 'Jamjade Car Rental')
            ),
            subject: "Jamjade Car Rental Booking Confirmation - {$reference}"
        );
    }

    public function content(): Content
    {
        $confirmation = app(BookingConfirmationViewData::class)->make($this->booking);

        return new Content(
            view: 'emails.bookings.confirmation',
            text: 'emails.bookings.confirmation-text',
            with: [
                'booking' => $this->booking,
                'confirmation' => $confirmation,
            ]
        );
    }

    public function attachments(): array
    {
        $pdfService = app(BookingConfirmationPdfService::class);

        return [
            Attachment::fromStorageDisk('local', $this->pdfPath)
                ->as($pdfService->filename($this->booking))
                ->withMime('application/pdf'),
        ];
    }

    public function send($mailer)
    {
        try {
            $sentMessage = parent::send($mailer);

            if (! $sentMessage) {
                throw new RuntimeException('The mail transport did not confirm delivery.');
            }
        } catch (Throwable $exception) {
            app(BookingEmailService::class)->markFailed($this->booking, $exception);

            throw $exception;
        }

        try {
            app(BookingEmailService::class)->markSent(
                $this->booking,
                $sentMessage->getMessageId()
            );
        } catch (Throwable $exception) {
            Log::critical('Booking confirmation was delivered, but sent tracking could not be updated.', [
                'booking_id' => $this->booking->getKey(),
                'error' => $exception->getMessage(),
            ]);
        }

        app(BookingEmailService::class)->deleteTemporaryPdf($this->pdfPath);

        return $sentMessage;
    }

    public function failed(Throwable $exception): void
    {
        app(BookingEmailService::class)->markFailed($this->booking, $exception);
        app(BookingEmailService::class)->deleteTemporaryPdf($this->pdfPath);
    }
}
