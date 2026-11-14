<?php

use App\Mail\OwnerVerificationMail;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Mail::fake();
});

it('verifies the new address before changing the owner email', function () {
    $owner = User::factory()->create(['password' => 'Password!123']);
    $owner->assignRole(['owner', 'admin']);
    $original = $owner->email;
    $this->actingAs($owner)->postJson('/admin/owner-profile/email', ['email' => 'new-owner@example.com', 'current_password' => 'Password!123'])->assertOk();
    expect($owner->fresh()->email)->toBe($original);
    $mail = Mail::sent(OwnerVerificationMail::class)->first();
    expect($mail->hasTo('new-owner@example.com'))->toBeTrue();
    $this->postJson('/admin/owner-profile/email/confirm', ['code' => '000000'])->assertUnprocessable();
    $this->postJson('/admin/owner-profile/email/confirm', ['code' => $mail->code])->assertOk();
    expect($owner->fresh()->email)->toBe('new-owner@example.com');
    $this->postJson('/admin/owner-profile/email/confirm', ['code' => $mail->code])->assertUnprocessable();
});

it('requires the current password and restricts profile endpoints to the owner', function () {
    $owner = User::factory()->create(['password' => 'Password!123']);
    $owner->assignRole(['owner', 'admin']);
    $this->actingAs($owner)->postJson('/admin/owner-profile/email', ['email' => 'new-owner@example.com', 'current_password' => 'wrong'])->assertUnprocessable();
    Mail::assertNothingSent();
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    $this->actingAs($admin)->postJson('/admin/owner-profile/email', ['email' => 'new-owner@example.com', 'current_password' => 'Password!123'])->assertForbidden();
});

it('enforces the password policy and changes the password', function () {
    $owner = User::factory()->create(['password' => 'Password!123']);
    $owner->assignRole(['owner', 'admin']);
    $this->actingAs($owner)->postJson('/admin/owner-profile/password', ['current_password' => 'Password!123', 'password' => 'weakpass', 'password_confirmation' => 'weakpass'])->assertUnprocessable();
    $this->postJson('/admin/owner-profile/password', ['current_password' => 'Password!123', 'password' => 'NewPassword!9', 'password_confirmation' => 'NewPassword!9'])->assertOk();
    expect(Hash::check('NewPassword!9', $owner->fresh()->password))->toBeTrue();
});

it('rejects codes after five incorrect attempts', function () {
    $owner = User::factory()->create(['password' => 'Password!123']);
    $owner->assignRole(['owner', 'admin']);
    $this->actingAs($owner)->postJson('/admin/owner-profile/email', ['email' => 'new-owner@example.com', 'current_password' => 'Password!123'])->assertOk();
    $code = Mail::sent(OwnerVerificationMail::class)->first()->code;
    $wrong = $code === '000000' ? '000001' : '000000';
    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/admin/owner-profile/email/confirm', ['code' => $wrong])->assertUnprocessable();
    }
    $this->postJson('/admin/owner-profile/email/confirm', ['code' => $code])->assertUnprocessable();
    expect($owner->fresh()->email)->not->toBe('new-owner@example.com');
});

it('rejects expired email verification codes', function () {
    $owner = User::factory()->create(['password' => 'Password!123']);
    $owner->assignRole(['owner', 'admin']);
    $this->actingAs($owner)->postJson('/admin/owner-profile/email', ['email' => 'new-owner@example.com', 'current_password' => 'Password!123'])->assertOk();
    $code = Mail::sent(OwnerVerificationMail::class)->first()->code;
    $this->travel(16)->minutes();
    $this->postJson('/admin/owner-profile/email/confirm', ['code' => $code])->assertUnprocessable();
    expect($owner->fresh()->email)->not->toBe('new-owner@example.com');
});
