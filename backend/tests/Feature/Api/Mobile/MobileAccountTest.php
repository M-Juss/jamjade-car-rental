<?php

use App\Enums\UserRole;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
});

it('requires authentication and the customer role for account changes', function () {
    foreach (['email', 'password'] as $action) {
        $this->putJson("/api/mobile/account/{$action}")->assertUnauthorized();
    }

    Sanctum::actingAs(createDriverUser());
    $this->putJson('/api/mobile/account/password', [
        'current_password' => 'password', 'password' => 'NewPassword123',
        'password_confirmation' => 'NewPassword123',
    ])->assertForbidden();
    $this->putJson('/api/mobile/account/email', [
        'email' => 'driver.changed@example.com', 'current_password' => 'password',
    ])->assertForbidden();
});

it('requires the current password to change the sign-in email without verification emails', function () {
    Mail::fake();
    $user = customerUser(['email' => 'old@example.com', 'email_verified_at' => now()]);
    Sanctum::actingAs($user);

    $this->putJson('/api/mobile/account/email', [
        'email' => 'new@example.com', 'current_password' => 'incorrect',
    ])->assertUnprocessable()->assertJsonValidationErrors('current_password');
    expect($user->fresh()->email)->toBe('old@example.com');

    $this->putJson('/api/mobile/account/email', [
        'email' => ' NEW@Example.com ', 'current_password' => 'password123',
    ])->assertOk()->assertJsonPath('data.email', 'new@example.com');
    expect($user->fresh()->email_verified_at)->toBeNull();
    Mail::assertNothingSent();
});

it('keeps account edits available before personal profile completion', function () {
    $user = User::factory()->create(['password' => 'password123']);
    $user->assignRole(UserRole::Customer);
    Sanctum::actingAs($user);
    $this->putJson('/api/mobile/account/email', [
        'email' => 'incomplete@example.com', 'current_password' => 'password123',
    ])->assertOk();
    expect($user->fresh()->customerProfile)->toBeNull();
});

it('rejects account credential changes through personal profile endpoints', function () {
    $user = customerUser(['email' => 'unchanged@example.com']);
    Sanctum::actingAs($user);
    foreach (['PUT', 'POST'] as $method) {
        $this->json($method, '/api/mobile/profile', ['email' => 'bypass@example.com'])
            ->assertUnprocessable()->assertJsonValidationErrors('email');
    }
    $this->putJson('/api/mobile/profile', ['first_name' => 'Updated'])
        ->assertOk()->assertJsonPath('data.email', 'unchanged@example.com');
    expect($user->fresh()->email)->toBe('unchanged@example.com');
});

it('changes the hashed password and revokes every mobile token', function () {
    $user = customerUser();
    $first = $user->createToken('account-test-one', ['mobile'])->plainTextToken;
    $second = $user->createToken('account-test-two', ['mobile'])->plainTextToken;
    $oldRememberToken = $user->remember_token;

    $this->withToken($first)->putJson('/api/mobile/account/password', [
        'current_password' => 'password123', 'password' => 'NewPassword123',
        'password_confirmation' => 'NewPassword123',
    ])->assertOk()->assertJsonPath('data', null);

    expect(Hash::check('NewPassword123', $user->fresh()->password))->toBeTrue()
        ->and($user->fresh()->password)->not->toBe('NewPassword123')
        ->and($user->tokens()->count())->toBe(0)
        ->and($user->fresh()->remember_token)->not->toBe($oldRememberToken);
    // Forget the guard's request-local user before testing revoked credentials.
    foreach ([$first, $second] as $token) {
        app('auth')->forgetGuards();
        $this->withToken($token)->getJson('/api/mobile/me')->assertUnauthorized();
    }
    app('auth')->forgetGuards();
    $this->postJson('/api/mobile/login', ['email' => $user->email, 'password' => 'password123'])
        ->assertUnprocessable();
    $this->postJson('/api/mobile/login', ['email' => $user->email, 'password' => 'NewPassword123'])
        ->assertOk();
});

it('preserves the password and sessions after invalid password changes', function (array $input, string $field) {
    $user = customerUser();
    $token = $user->createToken('preserved-session', ['mobile'])->plainTextToken;
    $hash = $user->password;
    $this->withToken($token)->putJson('/api/mobile/account/password', $input)
        ->assertUnprocessable()->assertJsonValidationErrors($field);
    expect($user->fresh()->password)->toBe($hash)->and($user->tokens()->count())->toBe(1);
})->with([
    'wrong current password' => [['current_password' => 'incorrect', 'password' => 'NewPassword123', 'password_confirmation' => 'NewPassword123'], 'current_password'],
    'missing current password' => [['password' => 'NewPassword123', 'password_confirmation' => 'NewPassword123'], 'current_password'],
    'short password' => [['current_password' => 'password123', 'password' => 'short', 'password_confirmation' => 'short'], 'password'],
    'mismatch' => [['current_password' => 'password123', 'password' => 'NewPassword123', 'password_confirmation' => 'Mismatch123'], 'password'],
    'same password' => [['current_password' => 'password123', 'password' => 'password123', 'password_confirmation' => 'password123'], 'password'],
    'bcrypt UTF-8 boundary' => [['current_password' => 'password123', 'password' => str_repeat('é', 37), 'password_confirmation' => str_repeat('é', 37)], 'password'],
]);

it('rate limits repeated current-password guesses per account', function () {
    Sanctum::actingAs(customerUser());
    for ($attempt = 0; $attempt < 5; $attempt++) {
        $this->putJson('/api/mobile/account/email', [
            'email' => 'rate-limited@example.com', 'current_password' => 'incorrect',
        ])->assertUnprocessable();
    }
    $this->putJson('/api/mobile/account/password', [
        'current_password' => 'password123', 'password' => 'NewPassword123',
        'password_confirmation' => 'NewPassword123',
    ])->assertTooManyRequests();
});
