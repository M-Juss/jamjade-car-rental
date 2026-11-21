<?php

use App\Mail\MobilePasswordResetMail;
use App\Mail\OwnerVerificationMail;
use App\Mail\VerifyMobileRegistrationMail;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->freezeTime();
    $this->seed(RoleAndPermissionSeeder::class);
    Mail::fake();
});

it('shares failed login limits across web and mobile and normalizes the identifier', function () {
    foreach (range(1, 4) as $_) {
        $this->postJson('/api/mobile/login', ['email' => 'limit@example.com', 'password' => 'wrong'])->assertUnprocessable();
    }
    $this->postJson('/admin/login', ['email' => 'LIMIT@example.com', 'password' => 'wrong'])->assertUnprocessable();

    foreach (['/admin/login', '/api/mobile/login'] as $path) {
        $this->postJson($path, ['email' => 'limit@example.com', 'password' => 'wrong'])
            ->assertStatus(429)->assertHeader('Retry-After', '60')->assertJsonPath('success', false);
    }

    $this->travel(61)->seconds();
    $this->postJson('/admin/login', ['email' => 'limit@example.com', 'password' => 'wrong'])->assertUnprocessable();
});

it('limits an identifier across IP addresses without blocking another identifier', function () {
    foreach (range(1, 5) as $index) {
        $this->withServerVariables(['REMOTE_ADDR' => "192.0.2.{$index}"])
            ->postJson('/api/mobile/login', ['login' => 'limit@example.com', 'password' => 'wrong'])->assertUnprocessable();
    }
    $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.10'])
        ->postJson('/api/mobile/login', ['email' => 'limit@example.com', 'password' => 'wrong'])->assertStatus(429);
    $this->postJson('/api/mobile/login', ['email' => 'other@example.com', 'password' => 'wrong'])->assertUnprocessable();
});

it('limits password spraying across different identifiers from one IP', function () {
    foreach (range(1, 30) as $index) {
        $this->postJson('/admin/login', ['email' => "spray{$index}@example.com", 'password' => 'wrong'])->assertUnprocessable();
    }
    $this->postJson('/api/mobile/login', ['email' => 'spray31@example.com', 'password' => 'wrong'])
        ->assertStatus(429)->assertHeader('Retry-After');
});

it('does not consume the identifier failure allowance for successful logins', function () {
    $customer = customerUser(['email' => 'success@example.com']);
    foreach (range(1, 6) as $_) {
        $this->postJson('/api/mobile/login', ['email' => $customer->email, 'password' => 'password123'])->assertOk();
    }
});

it('does not spend the registration allowance when login is throttled', function () {
    foreach (range(1, 5) as $_) {
        $this->postJson('/api/mobile/login', ['email' => 'separate@example.com', 'password' => 'wrong'])->assertUnprocessable();
    }
    $this->postJson('/api/mobile/login', ['email' => 'separate@example.com', 'password' => 'wrong'])->assertStatus(429);
    $this->postJson('/api/mobile/register', [
        'email' => 'separate@example.com', 'password' => 'Password123!', 'password_confirmation' => 'Password123!',
    ])->assertStatus(202);
});

it('returns the remaining registration resend delay and the hourly retry interval', function () {
    $registration = $this->postJson('/api/mobile/register', [
        'email' => 'resend-limit@example.com', 'password' => 'Password123!', 'password_confirmation' => 'Password123!',
    ])->assertStatus(202)->json('data.registrationId');
    $this->travel(20)->seconds();
    $this->postJson('/api/mobile/register/resend', ['registration_id' => $registration])
        ->assertStatus(429)->assertHeader('Retry-After', '40')->assertJsonPath('success', false);
    $this->travel(41)->seconds();
    foreach (range(1, 3) as $_) {
        $this->postJson('/api/mobile/register/resend', ['registration_id' => $registration])->assertOk();
        $this->travel(61)->seconds();
    }
    // The existing hourly policy counts issuance attempts, including an early resend.
    $response = $this->postJson('/api/mobile/register/resend', ['registration_id' => $registration])->assertStatus(429);
    expect((int) $response->headers->get('Retry-After'))->toBeGreaterThan(3000);
    Mail::assertSent(VerifyMobileRegistrationMail::class, 4);
});

it('returns the password reset resend delay without preventing verification of the issued code', function () {
    customerUser(['email' => 'reset-limit@example.com']);
    $id = $this->postJson('/api/mobile/password-reset', ['email' => 'reset-limit@example.com'])
        ->assertStatus(202)->json('data.resetId');
    $code = Mail::sent(MobilePasswordResetMail::class)->first()->code;
    $this->travel(20)->seconds();
    $this->postJson('/api/mobile/password-reset', ['email' => 'reset-limit@example.com'])
        ->assertStatus(429)->assertHeader('Retry-After', '40');
    $this->postJson('/api/mobile/password-reset/verify', ['reset_id' => $id, 'code' => $code])->assertOk();
});

it('keeps registration and password reset verification request budgets separate', function () {
    foreach (range(1, 10) as $_) {
        $this->postJson('/api/mobile/register/verify', ['registration_id' => 'bad', 'code' => 'bad'])->assertUnprocessable();
    }
    $this->postJson('/api/mobile/register/verify', ['registration_id' => 'bad', 'code' => 'bad'])->assertStatus(429)->assertHeader('Retry-After');
    $this->postJson('/api/mobile/password-reset/verify', ['reset_id' => 'bad', 'code' => 'bad'])->assertUnprocessable();
});

it('enforces owner email code cooldown and hourly allowance even when the target email changes', function () {
    $owner = User::factory()->create(['password' => 'Password123!']);
    $owner->assignRole(['owner', 'admin']);
    $this->actingAs($owner);
    $payload = ['email' => 'owner-new@example.com', 'current_password' => 'Password123!'];
    $this->postJson('/admin/owner-profile/email', $payload)->assertOk();
    $this->postJson('/admin/owner-profile/email', [...$payload, 'email' => 'owner-other@example.com'])
        ->assertStatus(429)->assertHeader('Retry-After', '60');
    foreach (range(1, 4) as $_) {
        $this->travel(61)->seconds();
        $this->postJson('/admin/owner-profile/email', $payload)->assertOk();
    }
    $this->travel(61)->seconds();
    $response = $this->postJson('/admin/owner-profile/email', $payload)->assertStatus(429);
    expect((int) $response->headers->get('Retry-After'))->toBeGreaterThan(3000);
    Mail::assertSent(OwnerVerificationMail::class, 5);
});
