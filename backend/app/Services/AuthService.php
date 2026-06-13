<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Models\CustomerProfile;
use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthService
{
    public function register(array $data): array
    {
        return DB::transaction(function () use ($data) {
            $user = User::create([
                'name' => Str::before($data['email'], '@'),
                'email' => $data['email'],
                'phone_number' => $data['phone_number'] ?? null,
                'password' => $data['password'],
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

            return [
                'user' => $user->fresh()->load('customerProfile', 'roles'),
                'token' => $this->issueMobileToken($user, $data['device_name'] ?? 'jamjade-mobile'),
            ];
        });
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

        if (! $user->hasRole(UserRole::Customer->value)) {
            throw ValidationException::withMessages([
                'login' => ['This account does not have mobile customer access.'],
            ]);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        activity()
            ->causedBy($user)
            ->performedOn($user)
            ->event('mobile_login')
            ->log('Customer logged in through the mobile API.');

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

    private function issueMobileToken(User $user, string $deviceName): string
    {
        $user->tokens()->where('name', $deviceName)->delete();

        return $user->createToken($deviceName, ['mobile'])->plainTextToken;
    }
}
