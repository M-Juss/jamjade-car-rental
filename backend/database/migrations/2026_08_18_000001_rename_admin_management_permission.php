<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        Permission::where('name', 'manage admin management')
            ->where('guard_name', 'web')
            ->update(['name' => 'manage staff management']);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        Permission::where('name', 'manage staff management')
            ->where('guard_name', 'web')
            ->update(['name' => 'manage admin management']);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
