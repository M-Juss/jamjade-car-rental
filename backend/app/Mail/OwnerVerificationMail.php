<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OwnerVerificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public readonly string $code, public readonly string $summary) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'JamJade owner verification');
    }

    public function content(): Content
    {
        return new Content(view: 'emails.auth.owner-verification', text: 'emails.auth.owner-verification-text');
    }
}
