<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class RcResearchAccessService
{
    public const TOKEN_ABILITY = 'rc-research';

    public function __construct(private readonly TelematicsCalibrationProfileService $profiles) {}

    public function enabled(): bool
    {
        return $this->profiles->active()['id'] === 'rc_demo';
    }

    public function createSession(User $user, string $deviceName): array
    {
        return DB::transaction(function () use ($user, $deviceName) {
            $user = User::query()->lockForUpdate()->findOrFail($user->id);
            abort_unless($this->enabled() && $user->is_active && $user->hasRole(UserRole::Admin->value),
                403, 'Data Collection is unavailable.');
            $deviceName = self::TOKEN_ABILITY.':'.$deviceName;
            $user->tokens()->where('name', $deviceName)->delete();
            $token = $user->createToken($deviceName, [self::TOKEN_ABILITY], now()->addHours(8));
            $user->forceFill(['last_login_at' => now()])->save();

            activity()->causedBy($user)->performedOn($user)
                ->event('mobile_rc_research_login')
                ->log('Admin signed in to mobile RC Research.');

            return ['user' => $user->load('roles'), 'token' => $token->plainTextToken];
        });
    }
}
