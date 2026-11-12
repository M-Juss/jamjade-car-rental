<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class MobilePasswordResetMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public readonly string $code) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Reset your JamJade password');
    }

    public function content(): Content
    {
        return new Content(view: 'emails.auth.mobile-password-reset', text: 'emails.auth.mobile-password-reset-text', with: ['code' => $this->code]);
    }
}
