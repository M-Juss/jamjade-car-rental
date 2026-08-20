<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleAndPermissionSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $modulePermissions = collect(config('staff_modules'))
            ->pluck('permission')
            ->all();

        $permissions = array_values(array_unique([
            ...$modulePermissions,
            'manage customers',
            'manage payments',
            'manage notifications',
        ]));

        $permissionModels = collect($permissions)
            ->map(fn (string $permission) => Permission::findOrCreate($permission, 'web'));

        $owner = Role::findOrCreate(UserRole::Owner->value, 'web');
        $admin = Role::findOrCreate(UserRole::Admin->value, 'web');
        $staff = Role::findOrCreate(UserRole::Staff->value, 'web');
        Role::findOrCreate(UserRole::Customer->value, 'web');
        $driver = Role::findOrCreate('driver', 'web');

        $owner->syncPermissions($permissionModels);
        $admin->syncPermissions(
            collect(config('staff_modules'))
                ->where('assignable', true)
                ->pluck('permission')
                ->all()
        );
        $staff->syncPermissions($permissionModels->whereIn('name', [
            'view dashboard',
            'manage bookings',
            'view fleet tracker',
            'review documents',
        ]));

        $driver->syncPermissions([
            Permission::findOrCreate('view dashboard', 'web'),
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
