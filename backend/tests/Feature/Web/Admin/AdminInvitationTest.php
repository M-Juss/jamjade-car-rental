<?php

use App\Models\User;
use App\Services\PersonnelService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\HttpKernel\Exception\HttpException;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Mail::fake();
    $this->admin = User::factory()->create(['is_active' => true]);
    $this->admin->assignRole('admin');
    $this->payload = ['first_name' => 'New', 'last_name' => 'Admin', 'email' => 'newadmin@example.test', 'phone_number' => '09123456789', 'role' => 'admin', 'is_active' => true, 'password' => 'Password123!', 'password_confirmation' => 'Password123!'];
});

it('allows only the owner to create a manual admin account', function () {
    $this->actingAs($this->admin)->postJson('/admin/admins/users', $this->payload)->assertForbidden();
    $this->postJson('/admin/personnel/users', $this->payload)->assertUnprocessable()->assertJsonValidationErrors('role');
    $this->admin->assignRole('owner');
    $this->postJson('/admin/admins/users', $this->payload)->assertCreated();
    $created = User::where('email', $this->payload['email'])->firstOrFail();
    expect($created->hasRole('admin'))->toBeTrue()->and($created->hasRole('owner'))->toBeFalse()
        ->and(Hash::check($this->payload['password'], $created->password))->toBeTrue()
        ->and($created->email_verified_at)->not->toBeNull();
    Mail::assertNothingSent();
    $this->getJson('/admin/admins')->assertOk()->assertJsonFragment(['email' => $created->email])->assertJsonMissing(['email' => $this->admin->email]);
    $this->postJson('/admin/admins/'.$created->id.'/revoke')->assertOk();
    expect($created->fresh()->is_active)->toBeFalse();
    $this->postJson('/admin/admins/'.$this->admin->id.'/revoke')->assertUnprocessable();
});

it('validates admin credentials and forbids role escalation', function () {
    $this->admin->assignRole('owner');
    $this->actingAs($this->admin)->postJson('/admin/admins/users', [...$this->payload, 'password' => 'short', 'password_confirmation' => 'short'])->assertUnprocessable()->assertJsonValidationErrors('password');
    $this->postJson('/admin/admins/users', [...$this->payload, 'role' => 'owner'])->assertUnprocessable()->assertJsonValidationErrors('role');
    $this->admin->removeRole('owner');
    expect(fn () => app(PersonnelService::class)->create($this->payload, $this->admin))->toThrow(HttpException::class);
});

it('does not issue or accept invitations', function () {
    $this->admin->assignRole('owner');
    $this->actingAs($this->admin)->postJson('/admin/admins/invitations', ['email' => 'newadmin@example.test'])->assertNotFound();
    $this->get('/admin-invitations/example')->assertNotFound();
    $this->post('/admin-invitations/example', [])->assertNotFound();
    Mail::assertNothingSent();
});
