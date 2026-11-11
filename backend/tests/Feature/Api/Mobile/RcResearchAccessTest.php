<?php

use App\Enums\UserRole;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    config(['telematics.calibration_profile' => 'rc_demo']);
    $this->password = Str::random(32);
    $this->admin = User::factory()->create(['password' => $this->password, 'is_active' => true]);
    $this->admin->assignRole(UserRole::Admin->value);
    $this->credentials = ['email' => $this->admin->email, 'password' => $this->password, 'device_name' => 'research-device'];
});

it('uses the existing Admin account with an expiring research-only mobile token', function () {
    $response = $this->postJson('/api/mobile/login', $this->credentials)
        ->assertOk()->assertJsonPath('data.user.id', $this->admin->id)
        ->assertJsonPath('data.user.roles.0', 'admin')->assertJsonMissingPath('data.user.profile');

    $token = PersonalAccessToken::findToken($response->json('data.token'));
    expect($token->abilities)->toBe(['rc-research'])
        ->and($token->expires_at->diffInSeconds(now(), true))->toBeBetween(28795, 28805);

    $this->withToken($response->json('data.token'))
        ->getJson('/api/mobile/rc-research')->assertOk()->assertJsonPath('data', null);
    $this->getJson('/api/mobile/me')->assertOk()->assertJsonPath('data.user.id', $this->admin->id);
    $this->assertDatabaseCount('customer_profiles', 0);
});

it('allows hosted Admin research login with explicit opt-in and keeps token scope', function () {
    $this->app->detectEnvironment(fn () => 'production');
    config(['telematics.hosted_rc_demo' => true]);
    $response = $this->postJson('/api/mobile/login', $this->credentials)->assertOk();
    $token = PersonalAccessToken::findToken($response->json('data.token'));
    expect($token->abilities)->toBe(['rc-research']);
    $this->withToken($response->json('data.token'))->getJson('/api/mobile/rc-research')->assertOk();
    $this->getJson('/api/mobile/bookings')->assertForbidden();
});

it('isolates research login from ordinary mobile sessions', function () {
    $ordinary = $this->admin->createToken('research-device', ['mobile']);
    $first = $this->postJson('/api/mobile/login', $this->credentials)->assertOk()->json('data.token');
    $second = $this->postJson('/api/mobile/login', $this->credentials)->assertOk()->json('data.token');
    expect(PersonalAccessToken::findToken($first))->toBeNull()
        ->and(PersonalAccessToken::findToken($second))->not->toBeNull()
        ->and(PersonalAccessToken::findToken($ordinary->plainTextToken))->not->toBeNull();
});

it('rejects Staff, inactive Admin accounts and incorrect credentials', function (string $case) {
    if ($case === 'inactive') {
        $this->admin->update(['is_active' => false]);
    } elseif ($case === 'wrong-password') {
        $this->credentials['password'] = Str::random(32);
    } else {
        $this->admin->syncRoles($case);
    }
    $response = $this->postJson('/api/mobile/login', $this->credentials);
    if ($case === 'inactive') {
        $response->assertUnauthorized();
    } else {
        $response->assertUnprocessable()->assertJsonValidationErrors('login');
    }
    $this->assertDatabaseCount('personal_access_tokens', 0);
})->with(['staff', 'inactive', 'wrong-password']);

it('validates research credentials and normalizes the email', function () {
    $this->postJson('/api/mobile/login', [])
        ->assertUnprocessable()->assertJsonValidationErrors(['login', 'password']);
    $this->postJson('/api/mobile/login', [
        ...$this->credentials, 'email' => ['unexpected'], 'device_name' => str_repeat('x', 121),
    ])->assertUnprocessable()->assertJsonValidationErrors(['email', 'device_name']);
    $this->postJson('/api/mobile/login', [
        ...$this->credentials, 'email' => ' '.strtoupper($this->admin->email).' ',
    ])->assertOk();
});

it('fails closed outside the local RC profile', function (string $environment, string $profile) {
    app()->instance('env', $environment);
    config(['telematics.calibration_profile' => $profile]);
    $this->postJson('/api/mobile/login', $this->credentials)->assertUnprocessable();
    $token = $this->admin->createToken('research', ['rc-research']);
    $this->withToken($token->plainTextToken)->getJson('/api/mobile/rc-research')->assertForbidden();
})->with([
    ['production', 'rc_demo'], ['staging', 'rc_demo'], ['testing', 'standard'],
]);

it('blocks research tokens from other authenticated mobile routes', function (string $method, string $path) {
    $token = $this->admin->createToken('research', ['rc-research']);
    $this->withToken($token->plainTextToken)->json($method, '/api/mobile/'.$path)->assertForbidden();
    $this->assertDatabaseCount('customer_profiles', 0);
})->with([
    ['GET', 'profile'], ['PUT', 'profile'], ['GET', 'bookings'], ['GET', 'notifications'],
    ['GET', 'driver/services'], ['GET', 'telematics/setup'], ['POST', 'telematics/trips/start'],
    ['GET', 'address/regions'], ['POST', 'paypal/orders'],
]);

it('requires a research bearer token rather than an ordinary token or web session', function (string $mode) {
    if ($mode === 'web') {
        $this->actingAs($this->admin, 'web');
    } else {
        $token = $this->admin->createToken('ordinary', [$mode]);
        $this->withToken($token->plainTextToken);
    }
    $this->getJson('/api/mobile/rc-research')->assertForbidden();
})->with(['web', 'mobile', '*']);

it('rechecks Admin access and RC mode for restored sessions but still permits revocation', function (string $change) {
    $token = $this->admin->createToken('research', ['rc-research']);
    if ($change === 'profile') {
        config(['telematics.calibration_profile' => 'standard']);
    } else {
        $this->admin->syncRoles('staff');
    }
    $this->withToken($token->plainTextToken)->getJson('/api/mobile/me')->assertForbidden();
    $this->getJson('/api/mobile/rc-research')->assertForbidden();
    $this->postJson('/api/mobile/logout')->assertOk();
    expect(PersonalAccessToken::findToken($token->plainTextToken))->toBeNull();
})->with(['profile', 'role']);

it('rejects non-Admin research tokens and unauthenticated requests', function () {
    $this->getJson('/api/mobile/rc-research')->assertUnauthorized();
    $this->admin->syncRoles('customer');
    $token = $this->admin->createToken('research', ['rc-research']);
    $this->withToken($token->plainTextToken)->getJson('/api/mobile/rc-research')->assertForbidden();
});

it('expires research sessions and rejects disabled accounts', function (bool $inactive) {
    $token = $this->admin->createToken('research', ['rc-research'], $inactive ? now()->addHour() : now()->subSecond());
    if ($inactive) {
        $this->admin->update(['is_active' => false]);
    }
    $this->withToken($token->plainTextToken)->getJson('/api/mobile/rc-research')
        ->assertStatus($inactive ? 403 : 401);
})->with([false, true]);

it('throttles research sign-in attempts using the mobile auth limit', function () {
    for ($attempt = 0; $attempt < 5; $attempt++) {
        $this->postJson('/api/mobile/login', [...$this->credentials, 'password' => 'invalid'])
            ->assertUnprocessable();
    }
    $this->postJson('/api/mobile/login', $this->credentials)->assertTooManyRequests();
});

it('keeps Customer and Driver sign-in on their existing mobile access', function (string $role) {
    $this->admin->syncRoles($role);
    $response = $this->postJson('/api/mobile/login', $this->credentials)
        ->assertOk()->assertJsonPath('data.user.roles.0', $role);
    $token = PersonalAccessToken::findToken($response->json('data.token'));
    expect($token->abilities)->toBe(['mobile'])
        ->and($token->name)->toBe('research-device');
    $this->withToken($response->json('data.token'))->getJson('/api/mobile/rc-research')->assertForbidden();
})->with(['customer', 'driver']);

it('prioritizes the Admin research scope for mixed roles and denies it outside RC mode', function () {
    $this->admin->assignRole('customer');
    $response = $this->postJson('/api/mobile/login', $this->credentials)->assertOk();
    expect(PersonalAccessToken::findToken($response->json('data.token'))->abilities)->toBe(['rc-research']);
    config(['telematics.calibration_profile' => 'standard']);
    $this->postJson('/api/mobile/login', $this->credentials)->assertUnprocessable();
});

it('removes the separate public research sign-in endpoints', function () {
    $this->postJson('/api/mobile/rc-research/login', $this->credentials)->assertNotFound();
    $this->getJson('/api/mobile/rc-research/availability')->assertNotFound();
});
