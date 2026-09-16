<?php

use App\Enums\UserRole;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
});

it('lets the owner create module-scoped roles and staff accounts', function () {
    $owner = User::factory()->create();
    $owner->assignRole(UserRole::Admin->value);

    $roleResponse = $this->actingAs($owner)->postJson('/staff/management/roles', [
        'name' => 'Fleet Clerk',
        'modules' => ['fleet_tracker', 'verification_queue'],
    ]);

    $roleResponse->assertCreated()
        ->assertJsonPath('data.role.name', 'fleet_clerk')
        ->assertJsonPath('data.role.modules.0', 'fleet_tracker')
        ->assertJsonPath('data.role.modules.1', 'verification_queue');

    $userResponse = $this->actingAs($owner)->postJson('/staff/management/users', [
        'first_name' => 'Ada',
        'last_name' => 'Reyes',
        'email' => 'ada.reyes@jamjade.test',
        'phone_number' => '09170000999',
        'role' => 'fleet_clerk',
        'is_active' => true,
        'password' => 'Password@123',
        'password_confirmation' => 'Password@123',
    ]);

    $userResponse->assertCreated()
        ->assertJsonPath('data.user.email', 'ada.reyes@jamjade.test')
        ->assertJsonPath('data.user.role.name', 'fleet_clerk')
        ->assertJsonMissing(['view video auditing']);

    $admin = User::where('email', 'ada.reyes@jamjade.test')->firstOrFail();

    expect($admin->can('view video auditing'))->toBeFalse();

    $this->actingAs($admin)->getJson('/admin/fleet-tracker')
        ->assertOk();

    $this->actingAs($admin)->getJson('/admin/dashboard')
        ->assertForbidden();
});

it('only grants video auditing when the role selects that module', function () {
    $owner = User::factory()->create();
    $owner->assignRole(UserRole::Admin->value);

    $response = $this->actingAs($owner)->postJson('/staff/management/roles', [
        'name' => 'Video Auditor',
        'modules' => ['video_auditing'],
    ]);

    $response->assertCreated()
        ->assertJsonPath('data.role.modules.0', 'video_auditing')
        ->assertJsonPath('data.role.permissions.0', 'view video auditing');
});

it('blocks non-admin users from staff management', function () {
    $staff = User::factory()->create();
    $staff->assignRole(UserRole::Staff->value);

    $this->actingAs($staff)->getJson('/staff/management')
        ->assertForbidden();
});

it('lets an owner log in with an existing password and open staff management', function () {
    $owner = User::factory()->create([
        'email' => 'owner.access@jamjade.test',
        'password' => 'existing-password',
    ]);
    $owner->assignRole(UserRole::Admin->value);

    $this->postJson('/admin/login', [
        'email' => ' OWNER.ACCESS@JAMJADE.TEST ',
        'password' => 'existing-password',
    ])->assertOk()
        ->assertJsonPath('data.user.roles.0', UserRole::Admin->value);

    $this->getJson('/staff/management')
        ->assertOk()
        ->assertJsonPath('data.summary.total', 0);
});

it('validates and normalizes admin login credentials through the request contract', function () {
    $this->postJson('/admin/login', [
        'email' => 'not-an-email',
        'password' => '',
        'remember' => 'not-a-boolean',
    ])->assertUnprocessable()
        ->assertJsonValidationErrors(['email', 'password', 'remember']);
});

it('validates staff management list filters', function () {
    $owner = User::factory()->create();
    $owner->assignRole(UserRole::Admin->value);

    $this->actingAs($owner)
        ->getJson('/staff/management?status=unknown')
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');
});

it('prevents protected roles from being edited', function () {
    $owner = User::factory()->create();
    $owner->assignRole(UserRole::Admin->value);
    $ownerRole = Role::where('name', UserRole::Admin->value)->firstOrFail();

    $this->actingAs($owner)->putJson("/staff/management/roles/{$ownerRole->id}", [
        'name' => 'Super Owner',
        'modules' => ['dashboard'],
    ])->assertUnprocessable()
        ->assertJsonValidationErrors('role');
});

it('hides admin details and lets the admin update and delete staff accounts', function () {
    $admin = User::factory()->create([
        'email' => 'admin@jamjade.test',
    ]);
    $admin->assignRole(UserRole::Admin->value);

    $staff = User::factory()->create([
        'name' => 'Original Staff',
        'email' => 'original.staff@jamjade.test',
    ]);
    $staff->assignRole(UserRole::Staff->value);

    $this->actingAs($admin)->getJson('/staff/management')
        ->assertOk()
        ->assertJsonPath('data.summary.total', 1)
        ->assertJsonPath('data.users.0.email', 'original.staff@jamjade.test')
        ->assertJsonMissing(['email' => 'admin@jamjade.test'])
        ->assertJsonMissing(['name' => UserRole::Admin->value]);

    $this->actingAs($admin)->putJson("/staff/management/users/{$staff->id}", [
        'first_name' => 'Updated',
        'last_name' => 'Staff',
        'email' => 'updated.staff@jamjade.test',
        'phone_number' => '09170000123',
        'role' => UserRole::Staff->value,
        'is_active' => false,
        'password' => 'New-password-123',
        'password_confirmation' => 'New-password-123',
    ])->assertOk()
        ->assertJsonPath('data.user.name', 'Updated Staff')
        ->assertJsonPath('data.user.email', 'updated.staff@jamjade.test')
        ->assertJsonPath('data.user.role.name', UserRole::Staff->value)
        ->assertJsonPath('data.user.isActive', false);

    $staff->refresh();

    expect($staff->hasRole(UserRole::Staff->value))->toBeTrue()
        ->and(Hash::check('New-password-123', $staff->password))->toBeTrue();

    $this->actingAs($admin)->deleteJson("/staff/management/users/{$staff->id}")
        ->assertOk();

    $this->assertDatabaseMissing('users', ['id' => $staff->id]);
});

it('validates staff names, email, phone number, and password policy', function () {
    $owner = User::factory()->create();
    $owner->assignRole(UserRole::Admin->value);

    $this->actingAs($owner)->postJson('/staff/management/users', [
        'first_name' => 'Ada123',
        'last_name' => 'Reyes!',
        'email' => 'not-an-email',
        'phone_number' => '091712345678',
        'role' => UserRole::Admin->value,
        'password' => 'weakpassword',
        'password_confirmation' => 'weakpassword',
    ])->assertUnprocessable()
        ->assertJsonValidationErrors([
            'first_name',
            'last_name',
            'email',
            'phone_number',
            'password',
        ]);
});
