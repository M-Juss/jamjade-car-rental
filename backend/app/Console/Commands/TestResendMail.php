<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Throwable;

class TestResendMail extends Command
{
    protected $signature = 'mail:test-resend {email : Recipient email address}';

    protected $description = 'Send a development test email through the configured SMTP mailer';

    public function handle(): int
    {
        if (app()->environment('production')) {
            $this->error('This command is disabled in production.');

            return self::FAILURE;
        }

        $email = trim((string) $this->argument('email'));

        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error('Enter a valid recipient email address.');

            return self::INVALID;
        }

        try {
            Mail::raw(
                'This is a Laravel Mail SMTP test for Jamjade Car Rental.',
                fn ($message) => $message
                    ->to($email)
                    ->subject('Jamjade Car Rental - SMTP Test')
            );
        } catch (Throwable $exception) {
            $error = preg_replace(
                '/\bre_[A-Za-z0-9_-]+\b/',
                '[redacted]',
                $exception->getMessage()
            ) ?? 'Mail delivery failed.';

            Log::error('Resend SMTP test email failed.', [
                'customer_email' => $email,
                'error' => Str::limit($error, 2000, '...'),
            ]);

            $this->error('The test email could not be sent. Check storage/logs/laravel.log.');

            return self::FAILURE;
        }

        $this->info("Test email sent to {$email}.");

        return self::SUCCESS;
    }
}
