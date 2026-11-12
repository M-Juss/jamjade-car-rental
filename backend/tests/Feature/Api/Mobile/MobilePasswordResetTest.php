<?php

use App\Enums\UserRole;
use App\Mail\MobilePasswordResetMail;
use App\Models\MobilePasswordReset;
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
function resetCustomer(): User
{
    $user = User::factory()->create(['email' => 'reset@example.com', 'is_active' => true, 'password' => Hash::make('OldPassword1!')]);
    $user->assignRole(UserRole::Customer->value);

    return $user;
}
it('resets a customer password once and revokes mobile tokens', function () {
    $user = resetCustomer();
    $user->createToken('phone', ['mobile']);
    $id = $this->postJson('/api/mobile/password-reset', ['email' => ' RESET@example.com '])->assertStatus(202)->json('data.resetId');
    $code = Mail::sent(MobilePasswordResetMail::class)->last()->code;
    expect(MobilePasswordReset::findOrFail($id)->code_hash)->not->toBe($code);
    $token = $this->postJson('/api/mobile/password-reset/verify', ['reset_id' => $id, 'code' => $code])->assertOk()->json('data.resetToken');
    $this->postJson('/api/mobile/password-reset/verify', ['reset_id' => $id, 'code' => $code])->assertUnprocessable();
    $payload = ['reset_id' => $id, 'reset_token' => $token, 'password' => 'NewPassword1!', 'password_confirmation' => 'NewPassword1!'];
    $this->postJson('/api/mobile/password-reset/complete', $payload)->assertOk();
    expect(Hash::check('NewPassword1!', $user->fresh()->password))->toBeTrue();
    expect($user->tokens()->count())->toBe(0);
    $this->postJson('/api/mobile/password-reset/complete', $payload)->assertUnprocessable();
});
it('does not reveal unknown or ineligible accounts', function () {
    $driver = User::factory()->create(['email' => 'driver@example.com', 'is_active' => true]);
    $driver->assignRole(UserRole::Driver->value);
    foreach (['missing@example.com', 'driver@example.com'] as $email) {
        $id = $this->postJson('/api/mobile/password-reset', ['email' => $email])->assertStatus(202)->json('data.resetId');
        $this->postJson('/api/mobile/password-reset/verify', ['reset_id' => $id, 'code' => '123456'])->assertUnprocessable();
    }
    Mail::assertNothingSent();
});
it('limits guesses and expires codes', function () {
    resetCustomer();
    $id = $this->postJson('/api/mobile/password-reset', ['email' => 'reset@example.com'])->json('data.resetId');
    $code = Mail::sent(MobilePasswordResetMail::class)->last()->code;
    $wrong = $code === '000000' ? '000001' : '000000';
    foreach (range(1, 5) as $_) {
        $this->postJson('/api/mobile/password-reset/verify', ['reset_id' => $id, 'code' => $wrong])->assertUnprocessable();
    }
    $this->postJson('/api/mobile/password-reset/verify', ['reset_id' => $id, 'code' => $code])->assertUnprocessable();
    $this->travel(61)->seconds();
    $id = $this->postJson('/api/mobile/password-reset', ['email' => 'reset@example.com'])->assertStatus(202)->json('data.resetId');
    $code = Mail::sent(MobilePasswordResetMail::class)->last()->code;
    $this->travel(16)->minutes();
    $this->postJson('/api/mobile/password-reset/verify', ['reset_id' => $id, 'code' => $code])->assertUnprocessable();
});
it('rejects verified resets after an email change', function () {
    $user = resetCustomer();
    $id = $this->postJson('/api/mobile/password-reset', ['email' => 'reset@example.com'])->json('data.resetId');
    $code = Mail::sent(MobilePasswordResetMail::class)->last()->code;
    $token = $this->postJson('/api/mobile/password-reset/verify', ['reset_id' => $id, 'code' => $code])->json('data.resetToken');
    $user->update(['email' => 'changed@example.com']);
    $this->postJson('/api/mobile/password-reset/complete', ['reset_id' => $id, 'reset_token' => $token, 'password' => 'NewPassword1!', 'password_confirmation' => 'NewPassword1!'])->assertUnprocessable();
});

it('rejects verified resets after the password has changed', function () {
    $user = resetCustomer();
    $id = $this->postJson('/api/mobile/password-reset', ['email' => 'reset@example.com'])->json('data.resetId');
    $code = Mail::sent(MobilePasswordResetMail::class)->last()->code;
    $token = $this->postJson('/api/mobile/password-reset/verify', ['reset_id' => $id, 'code' => $code])->json('data.resetToken');
    $user->update(['password' => 'OtherPassword1!']);
    $this->postJson('/api/mobile/password-reset/complete', ['reset_id' => $id, 'reset_token' => $token, 'password' => 'NewPassword1!', 'password_confirmation' => 'NewPassword1!'])->assertUnprocessable();
});

it('replaces old challenges after the resend cooldown', function () {
    resetCustomer();
    $oldId = $this->postJson('/api/mobile/password-reset', ['email' => 'reset@example.com'])->assertStatus(202)->json('data.resetId');
    $oldCode = Mail::sent(MobilePasswordResetMail::class)->last()->code;
    $this->postJson('/api/mobile/password-reset', ['email' => 'reset@example.com'])->assertStatus(429);
    $this->travel(61)->seconds();
    $newId = $this->postJson('/api/mobile/password-reset', ['email' => 'reset@example.com'])->assertStatus(202)->json('data.resetId');
    expect($newId)->not->toBe($oldId);
    $this->postJson('/api/mobile/password-reset/verify', ['reset_id' => $oldId, 'code' => $oldCode])->assertUnprocessable();
    $code = Mail::sent(MobilePasswordResetMail::class)->last()->code;
    $this->postJson('/api/mobile/password-reset/verify', ['reset_id' => $newId, 'code' => $code])->assertOk();
});

it('enforces password confirmation and strength without consuming the reset', function () {
    $user = resetCustomer();
    $id = $this->postJson('/api/mobile/password-reset', ['email' => 'reset@example.com'])->json('data.resetId');
    $code = Mail::sent(MobilePasswordResetMail::class)->last()->code;
    $token = $this->postJson('/api/mobile/password-reset/verify', ['reset_id' => $id, 'code' => $code])->json('data.resetToken');
    $this->postJson('/api/mobile/password-reset/complete', ['reset_id' => $id, 'reset_token' => $token, 'password' => 'weak', 'password_confirmation' => 'mismatch'])->assertUnprocessable()->assertJsonValidationErrors('password');
    expect(Hash::check('OldPassword1!', $user->fresh()->password))->toBeTrue();
    $this->postJson('/api/mobile/password-reset/complete', ['reset_id' => $id, 'reset_token' => $token, 'password' => 'NewPassword1!', 'password_confirmation' => 'NewPassword1!'])->assertOk();
});
