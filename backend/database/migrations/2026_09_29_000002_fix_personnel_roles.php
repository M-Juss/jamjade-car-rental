<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            $customRoles = DB::table('roles')->where('guard_name', 'web')
                ->whereNotIn('name', ['admin', 'staff', 'driver', 'customer', 'owner'])->pluck('id');

            if (DB::table('model_has_roles')->whereIn('role_id', $customRoles)->exists()) {
                throw new LogicException('Map custom-role accounts to an approved fixed role before retiring dynamic access.');
            }

            $driverRoleId = DB::table('roles')->where('name', 'driver')->where('guard_name', 'web')->value('id');

            if ($driverRoleId) {
                $driverAssignments = DB::table('model_has_roles')->where('role_id', $driverRoleId)->get();

                foreach ($driverAssignments as $assignment) {
                    if (DB::table('model_has_roles')->where('model_id', $assignment->model_id)
                        ->where('model_type', $assignment->model_type)->where('role_id', '!=', $driverRoleId)->exists()) {
                        throw new LogicException('Resolve mixed Driver roles before applying mobile-only access.');
                    }

                    DB::table('model_has_permissions')->where('model_id', $assignment->model_id)
                        ->where('model_type', $assignment->model_type)->delete();
                }

                DB::table('role_has_permissions')->where('role_id', $driverRoleId)->delete();
            }

            DB::table('roles')->whereIn('id', $customRoles)->delete();
            $oldPermission = DB::table('permissions')->where('name', 'manage staff management')->where('guard_name', 'web')->value('id');
            $newPermission = DB::table('permissions')->where('name', 'manage personnel')->where('guard_name', 'web')->value('id');

            if ($oldPermission && $newPermission) {
                foreach (['role_has_permissions', 'model_has_permissions'] as $table) {
                    foreach (DB::table($table)->where('permission_id', $oldPermission)->get() as $assignment) {
                        DB::table($table)->insertOrIgnore([
                            ...(array) $assignment,
                            'permission_id' => $newPermission,
                        ]);
                    }
                }
                DB::table('permissions')->where('id', $oldPermission)->delete();
            } elseif ($oldPermission) {
                DB::table('permissions')->where('id', $oldPermission)->update(['name' => 'manage personnel']);
            }
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        throw new LogicException('Retired role and permission assignments cannot be reconstructed. Restore from a backup if required.');
    }
};
