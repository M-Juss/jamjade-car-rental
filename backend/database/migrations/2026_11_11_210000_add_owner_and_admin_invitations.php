<?php

use App\Models\User;
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
        $owner = Role::findOrCreate('owner', 'web');
        $user = DB::table('users')->where('email', 'm.justinsayson@gmail.com')->whereNull('deleted_at')->first();
        if ($user && DB::table('model_has_roles')->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
            ->where('model_id', $user->id)->where('model_type', User::class)->where('roles.name', 'admin')->exists()) {
            DB::table('model_has_roles')->insertOrIgnore([
                'role_id' => $owner->id, 'model_type' => User::class, 'model_id' => $user->id,
            ]);
        }
        Schema::create('admin_invitations', function (Blueprint $table) {
            $table->id();
            $table->string('email', 160)->unique();
            $table->string('token_hash', 64)->nullable();
            $table->foreignId('invited_by')->constrained('users');
            $table->timestamp('expires_at');
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();
        });
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_invitations');
        Role::where('name', 'owner')->where('guard_name', 'web')->first()?->delete();
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};