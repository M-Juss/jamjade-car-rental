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
        $driver = Role::findOrCreate(UserRole::Driver->value, 'web');

        $admin->syncPermissions($permissionModels);
        $owner->syncPermissions($permissionModels);
        $staff->syncPermissions(
            collect(config('staff_modules'))
                ->where('staff_accessible', true)
                ->pluck('permission')
                ->all()
        );

        $driver->syncPermissions([]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
