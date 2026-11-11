<?php

use App\Enums\UserRole;
use App\Mail\VerifyMobileRegistrationMail;
use App\Models\PendingMobileRegistration;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Mail::fake();
});

function startMobileRegistration(string $email = 'otp.customer@example.com', array $extra = []): array
{
    $response = test()->postJson('/api/mobile/register', array_merge([
        'email' => $email,
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ], $extra))->assertStatus(202);
    $message = Mail::sent(VerifyMobileRegistrationMail::class)->last();

    return [$response->json('data.registrationId'), $message->code];
}

it('rejects malformed codes without changing the attempt count', function (mixed $code) {
    [$registrationId] = startMobileRegistration();

    $this->postJson('/api/mobile/register/verify', ['registration_id' => $registrationId, 'code' => $code])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('code');

    expect(PendingMobileRegistration::findOrFail($registrationId)->failed_attempts)->toBe(0);
})->with([
    'short' => '12345',
    'long' => '1234567',
    'non-ascii' => '１２３４５６',
    'trailing newline' => "123456\n",
    'array' => [[['123456']]],
]);

it('persists five incorrect guesses and then requires a fresh registration', function () {
    [$registrationId, $code] = startMobileRegistration();

    foreach (range(1, 5) as $attempt) {
        $this->postJson('/api/mobile/register/verify', [
            'registration_id' => $registrationId,
            'code' => $code === '000000' ? '000001' : '000000',
        ])->assertUnprocessable();
    }

    expect(PendingMobileRegistration::findOrFail($registrationId)->failed_attempts)->toBe(5);
    $this->postJson('/api/mobile/register/verify', ['registration_id' => $registrationId, 'code' => $code])
        ->assertUnprocessable();
    $this->assertDatabaseMissing('users', ['email' => 'otp.customer@example.com']);

    $this->travel(60)->seconds();
    [$freshId, $freshCode] = startMobileRegistration();
    expect($freshId)->not->toBe($registrationId);
    $this->postJson('/api/mobile/register/verify', ['registration_id' => $freshId, 'code' => $freshCode])
        ->assertCreated();
});

it('expires codes after fifteen minutes', function () {
    [$registrationId, $code] = startMobileRegistration();
    $this->travel(15)->minutes();

    $this->postJson('/api/mobile/register/verify', ['registration_id' => $registrationId, 'code' => $code])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('registration_id');
    $this->assertDatabaseMissing('users', ['email' => 'otp.customer@example.com']);
});

it('resends after cooldown, replaces the old code, and still creates only one customer', function () {
    [$registrationId, $oldCode] = startMobileRegistration();

    $this->postJson('/api/mobile/register/resend', ['registration_id' => $registrationId])->assertStatus(429);
    $this->travel(60)->seconds();
    $resend = $this->postJson('/api/mobile/register/resend', ['registration_id' => $registrationId])
        ->assertOk()
        ->assertJsonPath('data.registrationId', $registrationId);
    $newCode = Mail::sent(VerifyMobileRegistrationMail::class)->last()->code;

    expect($newCode)->not->toBe($oldCode);
    $this->postJson('/api/mobile/register/verify', ['registration_id' => $registrationId, 'code' => $oldCode])
        ->assertUnprocessable();
    $verified = $this->postJson('/api/mobile/register/verify', ['registration_id' => $registrationId, 'code' => $newCode])
        ->assertCreated();

    expect(User::where('email', 'otp.customer@example.com')->count())->toBe(1);
    expect(User::where('email', 'otp.customer@example.com')->first()->email_verified_at)->not->toBeNull();
    $this->assertDatabaseMissing('pending_mobile_registrations', ['id' => $registrationId]);
    $this->postJson('/api/mobile/register/verify', ['registration_id' => $registrationId, 'code' => $newCode])
        ->assertUnprocessable();
    expect($verified->json('data.user.roles'))->toContain(UserRole::Customer->value);
});

it('retains failed guesses across resend', function () {
    [$registrationId, $code] = startMobileRegistration();
    $wrongCode = $code === '000000' ? '000001' : '000000';
    $this->postJson('/api/mobile/register/verify', ['registration_id' => $registrationId, 'code' => $wrongCode])
        ->assertUnprocessable();
    $this->travel(60)->seconds();

    $this->postJson('/api/mobile/register/resend', ['registration_id' => $registrationId])->assertOk();

    expect(PendingMobileRegistration::findOrFail($registrationId)->failed_attempts)->toBe(1);
});

it('restarts an unfinished registration with a new capability after cooldown', function () {
    [$oldRegistrationId, $oldCode] = startMobileRegistration();
    $this->travel(60)->seconds();

    $new = $this->postJson('/api/mobile/register', [
        'email' => 'otp.customer@example.com',
        'password' => 'newpassword123',
        'password_confirmation' => 'newpassword123',
    ])->assertStatus(202);
    $newRegistrationId = $new->json('data.registrationId');
    $newCode = Mail::sent(VerifyMobileRegistrationMail::class)->last()->code;

    expect($newRegistrationId)->not->toBe($oldRegistrationId);
    $this->postJson('/api/mobile/register/verify', ['registration_id' => $oldRegistrationId, 'code' => $oldCode])
        ->assertUnprocessable();
    $this->postJson('/api/mobile/register/verify', ['registration_id' => $newRegistrationId, 'code' => $newCode])
        ->assertCreated();

    expect(User::where('email', 'otp.customer@example.com')->count())->toBe(1);
    expect(PendingMobileRegistration::count())->toBe(0);
});

it('rechecks email and phone uniqueness at verification time', function () {
    [$emailRegistration] = startMobileRegistration('race.email@example.com');
    customerUser(['email' => 'race.email@example.com']);
    $emailCode = Mail::sent(VerifyMobileRegistrationMail::class)->first()->code;
    $this->postJson('/api/mobile/register/verify', ['registration_id' => $emailRegistration, 'code' => $emailCode])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('email');

    [$phoneRegistration] = startMobileRegistration('race.phone@example.com', ['phone_number' => '09181234567']);
    customerUser(['email' => 'race.phone.existing@example.com', 'phone_number' => '09181234567']);
    $phoneCode = Mail::sent(VerifyMobileRegistrationMail::class)->last()->code;
    $this->postJson('/api/mobile/register/verify', ['registration_id' => $phoneRegistration, 'code' => $phoneCode])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('phone_number');

    $this->assertDatabaseMissing('users', ['email' => 'race.phone@example.com']);
});

it('supports leading-zero codes and retains optional phone and device values', function () {
    [$registrationId] = startMobileRegistration('leading.zero@example.com', [
        'phone_number' => '09181234567',
        'device_name' => 'leading-zero-device',
    ]);
    PendingMobileRegistration::findOrFail($registrationId)->forceFill(['code_hash' => Hash::make('000042')])->save();

    $this->postJson('/api/mobile/register/verify', ['registration_id' => $registrationId, 'code' => '000042'])
        ->assertCreated();

    $user = User::where('email', 'leading.zero@example.com')->firstOrFail();
    expect($user->phone_number)->toBe('09181234567');
    $this->assertDatabaseHas('personal_access_tokens', ['tokenable_id' => $user->id, 'name' => 'leading-zero-device']);
});

it('rolls back a failed initial email delivery without creating an account or pending row', function () {
    $mailFake = Mail::getFacadeRoot();
    $mailer = new class
    {
        public function send(VerifyMobileRegistrationMail $mail): never
        {
            throw new RuntimeException('Private transport details must not be returned.');
        }
    };
    Mail::shouldReceive('to')->once()->with('mail.failure@example.com')->andReturn($mailer);

    $response = $this->postJson('/api/mobile/register', [
        'email' => 'mail.failure@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ])->assertStatus(503);
    Mail::swap($mailFake);

    expect($response->getContent())->not->toContain('Private transport details');
    $this->assertDatabaseMissing('users', ['email' => 'mail.failure@example.com']);
    $this->assertDatabaseMissing('pending_mobile_registrations', ['email' => 'mail.failure@example.com']);
});

it('rolls back a failed resend and leaves the previously delivered code valid', function () {
    [$registrationId, $code] = startMobileRegistration('resend.failure@example.com');
    $this->travel(60)->seconds();
    $before = PendingMobileRegistration::findOrFail($registrationId)->only(['code_hash', 'expires_at']);
    $mailFake = Mail::getFacadeRoot();
    $mailer = new class
    {
        public function send(VerifyMobileRegistrationMail $mail): never
        {
            throw new RuntimeException('Private transport details must not be returned.');
        }
    };
    Mail::shouldReceive('to')->once()->with('resend.failure@example.com')->andReturn($mailer);

    $response = $this->postJson('/api/mobile/register/resend', ['registration_id' => $registrationId])
        ->assertStatus(503);
    Mail::swap($mailFake);
    expect($response->getContent())->not->toContain('Private transport details');
    expect(PendingMobileRegistration::findOrFail($registrationId)->only(['code_hash', 'expires_at']))->toEqual($before);

    $this->postJson('/api/mobile/register/verify', ['registration_id' => $registrationId, 'code' => $code])
        ->assertCreated();
});

it('shares the five per-hour email send limit across initial sends and resends', function () {
    [$registrationId] = startMobileRegistration('issuance.limit@example.com');
    foreach (range(1, 4) as $_) {
        $this->travel(60)->seconds();
        $this->postJson('/api/mobile/register/resend', ['registration_id' => $registrationId])->assertOk();
    }
    $this->travel(60)->seconds();
    $this->postJson('/api/mobile/register/resend', ['registration_id' => $registrationId])->assertStatus(429);
    expect(Mail::sent(VerifyMobileRegistrationMail::class))->toHaveCount(5);
});

it('limits registration issuance to twenty attempts per hour per IP address', function () {
    foreach (range(1, 20) as $index) {
        $this->postJson('/api/mobile/register', [
            'email' => "ip.limit.{$index}@example.com",
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertStatus(202);
        $this->travel(60)->seconds();
    }

    $this->postJson('/api/mobile/register', [
        'email' => 'ip.limit.21@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ])->assertStatus(429);
    expect(Mail::sent(VerifyMobileRegistrationMail::class))->toHaveCount(20);
});

it('limits verification to ten requests per minute per IP address', function () {
    foreach (range(1, 10) as $index) {
        [$registrationId, $code] = startMobileRegistration("verify.ip.{$index}@example.com");
        $this->postJson('/api/mobile/register/verify', ['registration_id' => $registrationId, 'code' => $code])
            ->assertCreated();
    }

    [$registrationId, $code] = startMobileRegistration('verify.ip.11@example.com');
    $this->postJson('/api/mobile/register/verify', ['registration_id' => $registrationId, 'code' => $code])
        ->assertStatus(429);
    $this->assertDatabaseMissing('users', ['email' => 'verify.ip.11@example.com']);
});

it('purges pending registrations after their absolute twenty-four-hour lifetime', function () {
    [$registrationId] = startMobileRegistration('purge.registration@example.com');
    PendingMobileRegistration::findOrFail($registrationId)->forceFill([
        'expires_at' => now()->addHour(),
        'absolute_expires_at' => now()->addHours(24),
    ])->save();
    $this->travel(24)->hours();
    $code = Mail::sent(VerifyMobileRegistrationMail::class)->first()->code;

    $this->postJson('/api/mobile/register/verify', ['registration_id' => $registrationId, 'code' => $code])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('registration_id');

    Artisan::call('mobile-registration:purge');

    $this->assertDatabaseMissing('pending_mobile_registrations', ['id' => $registrationId]);
});

it('rejects malformed registration field types safely', function (mixed $email, mixed $phone) {
    $this->postJson('/api/mobile/register', [
        'email' => $email,
        'phone_number' => $phone,
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ])->assertUnprocessable();
})->with([
    'array email and phone' => [['array@example.com'], ['09181234567']],
    'array email' => [['array@example.com'], null],
    'array phone' => ['valid@example.com', ['09181234567']],
]);

it('rejects passwords that exceed bcrypt byte limits', function (string $password) {
    $this->postJson('/api/mobile/register', [
        'email' => 'long.password@example.com',
        'password' => $password,
        'password_confirmation' => $password,
    ])->assertUnprocessable()
        ->assertJsonValidationErrors('password');
})->with([
    '73 ASCII bytes' => str_repeat('a', 73),
    '74 UTF-8 bytes' => str_repeat('é', 37),
]);
