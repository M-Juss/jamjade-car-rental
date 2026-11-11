<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Mail\VerifyMobileRegistrationMail;
use App\Models\CustomerProfile;
use App\Models\PendingMobileRegistration;
use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class AuthService
{
    public function __construct(private readonly RcResearchAccessService $research) {}

    public function beginRegistration(array $data, string $ipAddress): array
    {
        $emailHash = hash('sha256', $data['email']);
        $this->consumeRegistrationLimit('email:'.$emailHash, 5);
        $this->consumeRegistrationLimit('ip:'.hash('sha256', $ipAddress), 20);

        try {
            return DB::transaction(function () use ($data, $emailHash) {
                $pending = PendingMobileRegistration::query()->where('email_hash', $emailHash)->lockForUpdate()->first();
                if ($pending && $pending->absolute_expires_at->isFuture() && $pending->resend_available_at->isFuture()) {
                    throw new HttpException(429, 'A verification code was recently sent. Try again shortly.');
                }

                $code = $this->newRegistrationCode();
                while ($pending && Hash::check($code, $pending->code_hash)) {
                    $code = $this->newRegistrationCode();
                }
                $pending ??= new PendingMobileRegistration;
                $now = now();
                $pending->fill([
                    'id' => (string) Str::uuid(),
                    'email' => $data['email'],
                    'email_hash' => $emailHash,
                    'phone_number' => $data['phone_number'] ?? null,
                    'password' => Hash::make($data['password']),
                    'code_hash' => Hash::make($code),
                    'device_name' => $data['device_name'] ?? null,
                    'failed_attempts' => 0,
                    'expires_at' => $now->copy()->addMinutes(15),
                    'absolute_expires_at' => $now->copy()->addHours(24),
                    'resend_available_at' => $now->copy()->addSeconds(60),
                    'created_at' => $now,
                ])->save();
                $pending->refresh();
                $this->deliverRegistrationCode($pending, $code);

                return $this->pendingRegistrationDto($pending);
            });
        } catch (UniqueConstraintViolationException) {
            throw new HttpException(429, 'A registration is already in progress. Try again shortly.');
        }
    }

    public function resendRegistrationCode(string $registrationId, string $ipAddress): array
    {
        $current = PendingMobileRegistration::query()->whereKey($registrationId)->first();
        if (! $current || $current->absolute_expires_at->lte(now())) {
            throw ValidationException::withMessages(['registration_id' => ['This registration could not be found. Start again.']]);
        }
        $this->consumeRegistrationLimit('email:'.$current->email_hash, 5);
        $this->consumeRegistrationLimit('ip:'.hash('sha256', $ipAddress), 20);

        return DB::transaction(function () use ($registrationId) {
            $pending = PendingMobileRegistration::query()->whereKey($registrationId)->lockForUpdate()->first();
            if (! $pending || $pending->absolute_expires_at->lte(now())) {
                throw ValidationException::withMessages(['registration_id' => ['This registration could not be found. Start again.']]);
            }
            if ($pending->failed_attempts >= 5) {
                throw ValidationException::withMessages(['registration_id' => ['This registration has expired. Start again.']]);
            }
            if ($pending->absolute_expires_at->lte(now()->addMinutes(15))) {
                throw ValidationException::withMessages(['registration_id' => ['This registration has expired. Start again.']]);
            }
            if ($pending->resend_available_at->isFuture()) {
                throw new HttpException(429, 'A verification code was recently sent. Try again shortly.');
            }

            $code = $this->newRegistrationCode();
            while (Hash::check($code, $pending->code_hash)) {
                $code = $this->newRegistrationCode();
            }
            $this->replaceRegistrationCode($pending, $code);
            $pending->refresh();
            $this->deliverRegistrationCode($pending, $code);

            return $this->pendingRegistrationDto($pending);
        });
    }

    public function verifyRegistration(string $registrationId, string $code): array
    {
        try {
            $result = DB::transaction(function () use ($registrationId, $code) {
                $pending = PendingMobileRegistration::query()->whereKey($registrationId)->lockForUpdate()->first();
                if (! $pending || $pending->absolute_expires_at->lte(now()) || $pending->expires_at->lte(now()) || $pending->failed_attempts >= 5) {
                    return ['failure' => 'registration_id'];
                }

                if (! Hash::check($code, $pending->code_hash)) {
                    $pending->increment('failed_attempts');

                    return ['failure' => 'code'];
                }

                if (User::withTrashed()->where('email', $pending->email)->exists()) {
                    return ['failure' => 'email'];
                }
                if ($pending->phone_number && User::withTrashed()->where('phone_number', $pending->phone_number)->exists()) {
                    return ['failure' => 'phone_number'];
                }

                $user = User::create([
                    'name' => Str::before($pending->email, '@'),
                    'email' => $pending->email,
                    'phone_number' => $pending->phone_number,
                    'password' => $pending->password,
                    'email_verified_at' => now(),
                    'is_active' => true,
                ]);

                $user->assignRole(UserRole::Customer->value);

                CustomerProfile::create([
                    'user_id' => $user->id,
                    'verification_status' => 'pending',
                ]);

                activity()
                    ->causedBy($user)
                    ->performedOn($user)
                    ->event('mobile_registered')
                    ->log('Customer registered through the mobile API.');

                $result = [
                    'user' => $user->fresh()->load('customerProfile', 'roles'),
                    'token' => $this->issueMobileToken($user, $pending->device_name ?: 'jamjade-mobile'),
                ];
                $pending->delete();

                return ['result' => $result];
            });
        } catch (UniqueConstraintViolationException $exception) {
            if (User::withTrashed()->where('email', function ($query) use ($registrationId) {
                $query->select('email')->from('pending_mobile_registrations')->where('id', $registrationId);
            })->exists()) {
                throw ValidationException::withMessages(['email' => ['This email is already registered. Sign in instead.']]);
            }
            if (User::withTrashed()->whereIn('phone_number', function ($query) use ($registrationId) {
                $query->select('phone_number')->from('pending_mobile_registrations')->where('id', $registrationId)->whereNotNull('phone_number');
            })->exists()) {
                throw ValidationException::withMessages(['phone_number' => ['This phone number is already registered.']]);
            }

            throw $exception;
        }

        if (isset($result['failure'])) {
            $field = $result['failure'] === 'registration_id' ? 'registration_id' : $result['failure'];
            $message = match ($result['failure']) {
                'code' => 'The verification code is incorrect.',
                'email' => 'This email is already registered. Sign in instead.',
                'phone_number' => 'This phone number is already registered.',
                default => 'This verification code has expired. Start again.',
            };
            throw ValidationException::withMessages([$field => [$message]]);
        }

        return $result['result'];
    }

    private function consumeRegistrationLimit(string $key, int $maximum): void
    {
        $key = 'mobile-registration:'.hash('sha256', $key);
        if (RateLimiter::tooManyAttempts($key, $maximum)) {
            throw new HttpException(429, 'Too many registration attempts. Try again later.');
        }
        RateLimiter::hit($key, 3600);
    }

    private function newRegistrationCode(): string
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }

    private function replaceRegistrationCode(PendingMobileRegistration $pending, string $code): void
    {
        $now = now();
        $pending->forceFill([
            'code_hash' => Hash::make($code),
            'expires_at' => $now->copy()->addMinutes(15),
            'resend_available_at' => $now->copy()->addSeconds(60),
        ])->save();
    }

    private function deliverRegistrationCode(PendingMobileRegistration $pending, string $code): void
    {
        try {
            Mail::to($pending->email)->send(new VerifyMobileRegistrationMail($code));
        } catch (\Throwable $exception) {
            Log::warning('Mobile registration verification email could not be sent.', [
                'exception_type' => $exception::class,
            ]);
            throw new HttpException(503, 'We could not send the verification email. Try again shortly.');
        }
    }

    private function pendingRegistrationDto(PendingMobileRegistration $pending): array
    {
        return [
            'registrationId' => $pending->id,
            'email' => $pending->email,
            'expiresAt' => $pending->expires_at->toISOString(),
            'resendAvailableAt' => $pending->resend_available_at->toISOString(),
        ];
    }

    public function login(array $data): array
    {
        $login = $data['login'] ?? $data['email'] ?? $data['phone_number'] ?? null;

        $user = User::query()
            ->where('email', $login)
            ->orWhere('phone_number', $login)
            ->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'login' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (! $user->is_active) {
            throw new AuthenticationException('This account is inactive.');
        }

        if ($user->hasRole(UserRole::Admin->value) && $this->research->enabled()) {
            return $this->research->createSession($user, $data['device_name'] ?? 'jamjade-mobile');
        }

        if ($user->hasRole(UserRole::Admin->value)
            || ! $user->hasAnyRole([UserRole::Customer->value, DriverAssignmentService::DRIVER_ROLE])) {
            throw ValidationException::withMessages([
                'login' => ['This account does not have mobile customer access.'],
            ]);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        activity()
            ->causedBy($user)
            ->performedOn($user)
            ->event('mobile_login')
            ->log('User logged in through the mobile API.');

        return [
            'user' => $user->load('customerProfile', 'roles'),
            'token' => $this->issueMobileToken($user, $data['device_name'] ?? 'jamjade-mobile'),
        ];
    }

    public function logout(User $user): void
    {
        $user->currentAccessToken()?->delete();

        activity()
            ->causedBy($user)
            ->performedOn($user)
            ->event('mobile_logout')
            ->log('Customer logged out and revoked the active Sanctum token.');
    }

    public function updateAccountEmail(User $user, array $data): User
    {
        return DB::transaction(function () use ($user, $data) {
            $account = User::query()->lockForUpdate()->findOrFail($user->id);
            $this->verifyCurrentPassword($account, $data['current_password']);

            if ($account->email !== $data['email']) {
                $account->forceFill(['email' => $data['email'], 'email_verified_at' => null])->save();
            }

            return $account->load('customerProfile', 'roles');
        });
    }

    public function changeAccountPassword(User $user, array $data): void
    {
        DB::transaction(function () use ($user, $data) {
            $account = User::query()->lockForUpdate()->findOrFail($user->id);
            $this->verifyCurrentPassword($account, $data['current_password']);
            $account->forceFill([
                'password' => $data['password'],
                'remember_token' => Str::random(60),
            ])->save();
            $account->tokens()->delete();

            activity()->causedBy($account)->performedOn($account)
                ->event('mobile_password_changed')
                ->log('Customer changed their password and revoked mobile sessions.');
        });
    }

    private function verifyCurrentPassword(User $user, string $password): void
    {
        if (! Hash::check($password, $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }
    }

    private function issueMobileToken(User $user, string $deviceName): string
    {
        $user->tokens()->where('name', $deviceName)->delete();

        return $user->createToken($deviceName, ['mobile'])->plainTextToken;
    }
}
