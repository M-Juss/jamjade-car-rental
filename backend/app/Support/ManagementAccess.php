<?php

namespace App\Support;

use App\Models\User;

class ManagementAccess
{
    public static function role(User $user): ?string
    {
        if ($user->hasAnyRole(['customer', 'driver'])) {
            return null;
        }
        foreach (['owner', 'admin', 'staff'] as $role) {
            if ($user->hasRole($role)) {
                return $role;
            }
        }

        return null;
    }

    public static function permissions(User $user): array
    {
        $role = self::role($user);

        return $role ? config('management_permissions.'.$role, []) : [];
    }

    // Deny obsolete role/direct grants as well as hidden sidebar links.
    public static function gate(User $user, string $ability): ?bool
    {
        $managed = array_unique(array_merge(...array_values(config('management_permissions'))));
        if (! in_array($ability, $managed, true)) {
            return null;
        }

        return in_array($ability, self::permissions($user), true) ? null : false;
    }
}
