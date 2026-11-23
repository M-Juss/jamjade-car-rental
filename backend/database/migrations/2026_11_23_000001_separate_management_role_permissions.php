<?php

use App\Services\ManagementRoleService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('management_role_snapshots', function (Blueprint $table) {
            $table->unsignedTinyInteger('id')->primary();
            $table->json('permissions');
            $table->json('owner_admin_memberships');
        });
        DB::transaction(function () {
            $snapshot = Role::query()->where('guard_name', 'web')->whereIn('name', ['owner', 'admin', 'staff'])
                ->with('permissions')->get()->mapWithKeys(fn ($role) => [$role->name => $role->permissions->pluck('name')->all()])->all();
            $ownerRole = Role::findOrCreate('owner', 'web');
            $adminRole = Role::findOrCreate('admin', 'web');
            $ownerMemberships = DB::table('model_has_roles')->where('role_id', $ownerRole->id)->get();
            $memberships = $ownerMemberships->filter(fn ($membership) => DB::table('model_has_roles')
                ->where('model_type', $membership->model_type)->where('model_id', $membership->model_id)->where('role_id', $adminRole->id)->exists());
            DB::table('management_role_snapshots')->insert(['id' => 1, 'permissions' => json_encode($snapshot, JSON_THROW_ON_ERROR),
                'owner_admin_memberships' => json_encode($memberships->values()->all(), JSON_THROW_ON_ERROR)]);
            app(ManagementRoleService::class)->sync();
            foreach ($memberships as $membership) {
                DB::table('model_has_roles')->where('model_type', $membership->model_type)
                    ->where('model_id', $membership->model_id)->where('role_id', $adminRole->id)->delete();
            }
        });
    }

    public function down(): void
    {
        $row = DB::table('management_role_snapshots')->where('id', 1)->first();
        $snapshot = $row->permissions;
        DB::transaction(function () use ($snapshot) {
            foreach (json_decode($snapshot, true, flags: JSON_THROW_ON_ERROR) as $role => $permissions) {
                Role::findByName($role, 'web')->syncPermissions($permissions);
            }
        });
        foreach (json_decode($row->owner_admin_memberships, true, flags: JSON_THROW_ON_ERROR) as $membership) {
            if (DB::table('model_has_roles')->where($membership)->exists()) {
                DB::table('model_has_roles')->insertOrIgnore([...$membership, 'role_id' => Role::findByName('admin', 'web')->id]);
            }
        }
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        Schema::dropIfExists('management_role_snapshots');
    }
};
