<?php

namespace App\Mail;

use App\Models\BookingPaymentDocument;
use App\Services\BookingEmailService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Attachment;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class BookingConfirmationMail extends Mailable implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable, SerializesModels;

    public int $tries = 3;

    public array $backoff = [30, 60];

    public function __construct(public BookingPaymentDocument $document, public string $deliveryToken) {}

    public function envelope(): Envelope
    {
        $context = $this->document->context;
        $documents = ($context['formatVersion'] ?? 1) >= 3 ? 'Rental Information and Payment Receipt' : 'Invoice and Payment Receipt';

        return new Envelope(
            from: new Address(config('mail.from.address'), config('mail.from.name', 'Jamjade Car Rental')),
            subject: "{$context['bookingReference']} | {$documents} | {$context['receipt']['reference']}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.bookings.confirmation',
            text: 'emails.bookings.confirmation-text',
            with: ['confirmation' => $this->document->context],
        );
    }

    public function attachments(): array
    {
        return [
            Attachment::fromStorageDisk('local', $this->document->rental_information_path)->as($this->document->rental_information_filename)->withMime('application/pdf'),
            Attachment::fromStorageDisk('local', $this->document->receipt_path)->as($this->document->receipt_filename)->withMime('application/pdf'),
        ];
    }

    public function send($mailer)
    {
        return Cache::lock('booking-payment-documents:'.$this->document->id, 120)->block(5, function () use ($mailer) {
            $this->document->refresh();
            if ($this->document->delivery_token !== $this->deliveryToken || $this->document->delivery_status === BookingEmailService::STATUS_SENT) {
                return null;
            }
            $recipient = $this->document->booking?->user?->email;
            if (empty($recipient)) {
                throw new RuntimeException('The renter does not have an email address.');
            }
            // Account email may change while a message is queued; never send to a superseded address.
            $this->to = [];
            $this->to($recipient);
            $sentMessage = parent::send($mailer);
            if (! $sentMessage) {
                throw new RuntimeException('The mail transport did not confirm delivery.');
            }

            try {
                app(BookingEmailService::class)->markSent($this->document, $this->deliveryToken);
            } catch (Throwable $exception) {
                // The transport already accepted the email. Do not retry it because bookkeeping failed.
                Log::critical('Payment documents were delivered, but sent tracking could not be updated.', [
                    'document_id' => $this->document->id, 'exception_type' => $exception::class,
                ]);
            }

            return $sentMessage;
        });
    }

    public function failed(Throwable $exception): void
    {
        app(BookingEmailService::class)->markFailed($this->document, $exception, $this->deliveryToken);
    }
}
