<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;

class AdminInvitationMail extends Mailable
{
    public function __construct(public readonly string $invitationUrl) {}

    public function build(): static
    {
        return $this->subject('Your JamJade Admin invitation')->view('emails.auth.admin-invitation');
    }
}
