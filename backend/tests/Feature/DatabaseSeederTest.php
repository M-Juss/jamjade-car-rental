<?php

use App\Enums\UserRole;
use App\Models\Booking;
use App\Models\User;
use App\Models\Vehicle;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

it('requires a private initial password before creating hosted seed accounts', function () {
    $this->app->detectEnvironment(fn () => 'production');
    config(['auth.initial_owner_password' => null]);
    expect(fn () => Artisan::call('db:seed', ['--class' => DatabaseSeeder::class, '--force' => true]))->toThrow(RuntimeException::class);
    $this->assertDatabaseCount('users', 0);
});

it('uses the configured hosted password once and preserves it on a later seed', function () {
    $this->app->detectEnvironment(fn () => 'production');
    $password = Str::random(32);
    config(['auth.initial_owner_password' => $password]);
    Artisan::call('db:seed', ['--class' => DatabaseSeeder::class, '--force' => true]);
    $owner = User::sole();
    expect(Hash::check($password, $owner->password))->toBeTrue();
    $hash = $owner->password;
    config(['auth.initial_owner_password' => Str::random(32)]);
    Artisan::call('db:seed', ['--class' => DatabaseSeeder::class, '--force' => true]);
    expect($owner->fresh()->password)->toBe($hash);
});

it('seeds only the Jamjade owner account without demo vehicle data', function () {
    $this->seed(DatabaseSeeder::class);

    $owner = User::where('email', 'ofcl.jamjadecarrental@gmail.com')->first();

    expect(User::count())->toBe(1)
        ->and(User::where('email', 'admin@jamjade.test')->exists())->toBeFalse()
        ->and(User::where('email', 'test@example.com')->exists())->toBeFalse()
        ->and(User::where('email', 'jamjadecarrental@gmail.com')->exists())->toBeFalse()
        ->and(User::where('email', 'jamjadecarental@gmail.com')->exists())->toBeFalse()
        ->and($owner)->not->toBeNull()
        ->and($owner?->phone_number)->toBe('09170000002')
        ->and(Hash::check('Jamjade@123', (string) $owner?->password))->toBeTrue()
        ->and($owner?->hasRole(UserRole::Admin->value))->toBeTrue()
        ->and(Vehicle::count())->toBe(0)
        ->and(Booking::count())->toBe(0);
});

it('lets the seeded Jamjade owner log in to the web admin', function () {
    $this->seed(DatabaseSeeder::class);

    $this->postJson('/admin/login', [
        'email' => 'ofcl.jamjadecarrental@gmail.com',
        'password' => 'Jamjade@123',
    ])
        ->assertOk()
        ->assertJsonPath('message', 'Admin login successful.')
        ->assertJsonPath('data.user.email', 'ofcl.jamjadecarrental@gmail.com')
        ->assertJsonPath('data.user.roles.0', UserRole::Admin->value);
});

it('lets an already authenticated web admin submit login again without redirecting to html', function () {
    $this->seed(DatabaseSeeder::class);

    $payload = [
        'email' => 'ofcl.jamjadecarrental@gmail.com',
        'password' => 'Jamjade@123',
    ];

    $this->postJson('/admin/login', $payload)->assertOk();

    $this->postJson('/admin/login', $payload)
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('message', 'Admin login successful.')
        ->assertJsonPath('data.user.email', 'ofcl.jamjadecarrental@gmail.com');
});

it('updates only the previous owner email and preserves the account', function () {
    $this->seed(DatabaseSeeder::class);
    $owner = User::sole();
    $owner->update(['email' => 'jamjade.carrentalofficial@gmail.com']);
    $migration = require database_path('migrations/2026_11_12_130000_update_seeded_owner_email.php');
    $migration->up();

    expect($owner->fresh()->email)->toBe('ofcl.jamjadecarrental@gmail.com')
        ->and($owner->fresh()->hasRole('owner'))->toBeTrue();
});

it('does not replace another account using the intended owner email', function () {
    $this->seed(DatabaseSeeder::class);
    $owner = User::sole();
    $owner->update(['email' => 'jamjade.carrentalofficial@gmail.com']);
    User::factory()->create(['email' => 'ofcl.jamjadecarrental@gmail.com']);
    $migration = require database_path('migrations/2026_11_12_130000_update_seeded_owner_email.php');

    expect(fn () => $migration->up())->toThrow(RuntimeException::class);
    expect($owner->fresh()->email)->toBe('jamjade.carrentalofficial@gmail.com');
});
