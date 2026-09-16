<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $oldAdminRoleId = DB::table('roles')
            ->where('name', 'admin')
            ->where('guard_name', 'web')
            ->value('id');

        $staffRoleId = DB::table('roles')
            ->where('name', 'staff')
            ->where('guard_name', 'web')
            ->value('id');

        if ($oldAdminRoleId && $staffRoleId) {
            DB::table('model_has_roles')
                ->where('role_id', $oldAdminRoleId)
                ->update(['role_id' => $staffRoleId]);
        }

        if ($oldAdminRoleId) {
            DB::table('role_has_permissions')
                ->where('role_id', $oldAdminRoleId)
                ->delete();

            DB::table('roles')
                ->where('id', $oldAdminRoleId)
                ->delete();
        }

        DB::table('roles')
            ->where('name', 'owner')
            ->where('guard_name', 'web')
            ->update(['name' => 'admin']);
    }

    public function down(): void
    {
        DB::table('roles')
            ->where('name', 'admin')
            ->where('guard_name', 'web')
            ->update(['name' => 'owner']);

        DB::table('roles')
            ->where('name', 'staff')
            ->where('guard_name', 'web')
            ->firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
    }
};
