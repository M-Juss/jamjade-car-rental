<?php

use App\Models\User;
use App\Models\Vehicle;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

it('retires legacy video assignments and dashcam features without granting replacement access', function () {
    $this->seed(RoleAndPermissionSeeder::class);
    $legacy = Permission::findOrCreate('view video auditing', 'web');
    $mixedRole = Role::create(['name' => 'fleet_clerk', 'guard_name' => 'web']);
    $mixedRole->givePermissionTo(['view fleet tracker', $legacy]);
    $videoOnlyRole = Role::create(['name' => 'retired_video_auditor', 'guard_name' => 'web']);
    $videoOnlyRole->givePermissionTo($legacy);
    $mixedUser = User::factory()->create();
    $mixedUser->assignRole($mixedRole);
    $mixedUser->givePermissionTo($legacy);
    $videoOnlyUser = User::factory()->create(['password' => 'Password@123']);
    $videoOnlyUser->assignRole($videoOnlyRole);
    expect($mixedUser->can('view video auditing'))->toBeTrue();

    $vehicle = Vehicle::factory()->create();
    foreach (['Dashcam', 'dashcam', ' DASHCAM ', 'Reverse Camera', 'GPS Navigation'] as $feature) {
        $vehicle->features()->create(['feature_name' => $feature]);
    }

    $migration = require database_path('migrations/2026_09_29_000001_retire_video_features.php');
    $migration->up();
    $migration->up();

    $this->assertDatabaseMissing('permissions', ['id' => $legacy->id]);
    expect(DB::table('role_has_permissions')->where('permission_id', $legacy->id)->exists())->toBeFalse()
        ->and(DB::table('model_has_permissions')->where('permission_id', $legacy->id)->exists())->toBeFalse()
        ->and($mixedRole->fresh()->permissions->pluck('name')->all())->toBe(['view fleet tracker'])
        ->and($videoOnlyRole->fresh()->permissions)->toHaveCount(0)
        ->and($mixedUser->fresh()->getAllPermissions()->pluck('name')->all())->toBe(['view fleet tracker'])
        ->and($videoOnlyUser->fresh()->getAllPermissions())->toHaveCount(0)
        ->and($vehicle->fresh()->features->pluck('feature_name')->all())->toBe(['GPS Navigation', 'Reverse Camera']);

    $this->assertDatabaseHas('users', ['id' => $videoOnlyUser->id, 'is_active' => true]);
    $this->assertDatabaseHas('model_has_roles', ['role_id' => $videoOnlyRole->id, 'model_id' => $videoOnlyUser->id]);
    $this->postJson('/admin/login', [
        'email' => $videoOnlyUser->email,
        'password' => 'Password@123',
    ])->assertUnprocessable()->assertJsonValidationErrors('email');
});
