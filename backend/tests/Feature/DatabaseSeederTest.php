<?php

use App\Enums\UserRole;
use App\Models\Booking;
use App\Models\User;
use App\Models\Vehicle;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

it('seeds only the Jamjade owner account without demo vehicle data', function () {
    $this->seed(DatabaseSeeder::class);

    $owner = User::where('email', 'jamjade.carrentalofficial@gmail.com')->first();

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
        'email' => 'jamjade.carrentalofficial@gmail.com',
        'password' => 'Jamjade@123',
    ])
        ->assertOk()
        ->assertJsonPath('message', 'Admin login successful.')
        ->assertJsonPath('data.user.email', 'jamjade.carrentalofficial@gmail.com')
        ->assertJsonPath('data.user.roles.0', UserRole::Admin->value);
});

it('lets an already authenticated web admin submit login again without redirecting to html', function () {
    $this->seed(DatabaseSeeder::class);

    $payload = [
        'email' => 'jamjade.carrentalofficial@gmail.com',
        'password' => 'Jamjade@123',
    ];

    $this->postJson('/admin/login', $payload)->assertOk();

    $this->postJson('/admin/login', $payload)
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('message', 'Admin login successful.')
        ->assertJsonPath('data.user.email', 'jamjade.carrentalofficial@gmail.com');
});
