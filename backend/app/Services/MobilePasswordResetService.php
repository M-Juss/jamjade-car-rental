<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Mail\MobilePasswordResetMail;
use App\Models\MobilePasswordReset;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class MobilePasswordResetService
{
    public function begin(string $email, string $ip): array
    {
        $emailHash = hash('sha256', $email);
        foreach ([['email:'.$emailHash, 5], ['ip:'.hash('sha256', $ip), 20]] as [$part, $max]) {
            $key = 'mobile-password-reset:'.hash('sha256', $part);
            if (RateLimiter::tooManyAttempts($key, $max)) {
                throw new HttpException(429, 'Too many requests. Try again later.');
            }
            RateLimiter::hit($key, 3600);
        }

        try {
            return DB::transaction(function () use ($email, $emailHash) {
                $existing = MobilePasswordReset::query()->where('email_hash', $emailHash)->lockForUpdate()->first();
                if ($existing && $existing->resend_available_at->isFuture()) {
                    throw new HttpException(429, 'A code was recently requested. Try again shortly.');
                }
                $user = User::query()->where('email', $email)->first();
                if (! $this->isEligible($user)) {
                    $user = null;
                }
                $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
                while ($existing && Hash::check($code, $existing->code_hash)) {
                    $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
                }
                $record = $existing ?? new MobilePasswordReset;
                $now = now();
                $record->fill(['id' => (string) Str::uuid(), 'email_hash' => $emailHash, 'user_id' => $user?->id, 'password_fingerprint' => $user ? hash('sha256', $user->password) : null, 'code_hash' => Hash::make($code), 'token_hash' => null, 'failed_attempts' => 0, 'expires_at' => $now->copy()->addMinutes(15), 'resend_available_at' => $now->copy()->addSeconds(60)])->save();
                if ($user) {
                    try {
                        Mail::to($email)->send(new MobilePasswordResetMail($code));
                    } catch (\Throwable $e) {
                        Log::warning('Mobile password reset email could not be sent.', ['exception_type' => $e::class]);
                    }
                }

                return ['resetId' => $record->id, 'expiresAt' => $record->expires_at->toISOString(), 'resendAvailableAt' => $record->resend_available_at->toISOString()];
            });
        } catch (UniqueConstraintViolationException) {
            throw new HttpException(429, 'A code was recently requested. Try again shortly.');
        }
    }

    public function verify(string $id, string $code): string
    {
        $result = DB::transaction(function () use ($id, $code) {
            $record = MobilePasswordReset::query()->whereKey($id)->lockForUpdate()->first();
            if (! $record || $record->expires_at->isPast() || $record->failed_attempts >= 5 || $record->token_hash) {
                return null;
            }
            $validCode = Hash::check($code, $record->code_hash);
            if (! $record->user_id || ! $validCode) {
                $record->increment('failed_attempts');

                return null;
            }
            $token = bin2hex(random_bytes(32));
            $record->update(['token_hash' => hash('sha256', $token)]);

            return $token;
        });
        if (! $result) {
            throw ValidationException::withMessages(['code' => ['The code is incorrect or expired. Request a new code.']]);
        }

        return $result;
    }

    public function complete(string $id, string $token, string $password): void
    {
        $success = DB::transaction(function () use ($id, $token, $password) {
            $record = MobilePasswordReset::query()->whereKey($id)->lockForUpdate()->first();
            if (! $record || ! $record->token_hash || $record->expires_at->isPast() || ! hash_equals($record->token_hash, hash('sha256', $token))) {
                return false;
            }
            $user = User::query()->whereKey($record->user_id)->lockForUpdate()->first();
            if (! $this->isEligible($user) || ! hash_equals($record->email_hash, hash('sha256', strtolower(trim($user->email)))) || ! $record->password_fingerprint || ! hash_equals($record->password_fingerprint, hash('sha256', $user->password))) {
                return false;
            }
            $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();
            $user->tokens()->delete();
            $record->delete();

            return true;
        });
        if (! $success) {
            throw ValidationException::withMessages(['reset_token' => ['Your reset session expired. Request a new code.']]);
        }
    }

    private function isEligible(?User $user): bool
    {
        return $user !== null && $user->is_active && $user->hasRole(UserRole::Customer->value)
            && ! $user->hasAnyRole([UserRole::Owner->value, UserRole::Admin->value, UserRole::Staff->value, UserRole::Driver->value]);
    }
}
