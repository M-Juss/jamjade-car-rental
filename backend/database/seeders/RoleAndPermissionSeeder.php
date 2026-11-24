<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Services\ManagementRoleService;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleAndPermissionSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        Role::findOrCreate(UserRole::Customer->value, 'web');
        $driver = Role::findOrCreate(UserRole::Driver->value, 'web');

        app(ManagementRoleService::class)->sync();

        $driver->syncPermissions([]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
