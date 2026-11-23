<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class BookingDriverUpdateMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public readonly array $update) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->update['title'].' — '.$this->update['bookingCode']);
    }

    public function content(): Content
    {
        return new Content(view: 'emails.bookings.driver-update', text: 'emails.bookings.driver-update-text');
    }
}
