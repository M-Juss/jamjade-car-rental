<?php

use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
});

it('rejects the customer number when creating or editing an emergency contact', function (bool $hasContact, string $phoneNumber) {
    $user = customerUser(['phone_number' => '09170000001']);

    if (! $hasContact) {
        $user->emergencyContacts()->delete();
    }

    Sanctum::actingAs($user);

    $this->postJson('/api/mobile/profile/emergency-contact', [
        'name' => 'Emergency Person',
        'relationship' => 'Friend',
        'phone_number' => $phoneNumber,
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('phone_number')
        ->assertJsonPath('errors.phone_number.0', 'Emergency contact number must be different from your phone number.');

    if ($hasContact) {
        expect($user->emergencyContacts()->sole()->phone_number)->toBe('09123456789');
    } else {
        expect($user->emergencyContacts()->exists())->toBeFalse();
    }
})->with([true, false])->with(['09170000001', '0917 000-0001']);

it('saves a different emergency number on creation and editing', function (bool $hasContact) {
    $user = customerUser(['phone_number' => '09170000001']);

    if (! $hasContact) {
        $user->emergencyContacts()->delete();
    }

    Sanctum::actingAs($user);

    $this->postJson('/api/mobile/profile/emergency-contact', [
        'name' => 'Emergency Person',
        'relationship' => 'Friend',
        'phone_number' => '0917 000-0002',
    ])
        ->assertOk()
        ->assertJsonPath('data.phone_number', '09170000002');

    expect($user->emergencyContacts()->sole()->phone_number)->toBe('09170000002');
})->with([true, false]);

it('compares an emergency number against the normalized saved customer number', function () {
    $user = customerUser(['phone_number' => '0917 000-0001']);
    Sanctum::actingAs($user);

    $this->postJson('/api/mobile/profile/emergency-contact', [
        'name' => 'Emergency Person',
        'relationship' => 'Friend',
        'phone_number' => '09170000001',
    ])
        ->assertUnprocessable()
        ->assertJsonPath('errors.phone_number.0', 'Emergency contact number must be different from your phone number.');
});

dataset('mobile profile phone writes', [
    'profile update' => ['PUT', '/api/mobile/profile'],
    'profile upload' => ['POST', '/api/mobile/profile'],
    'profile completion' => ['POST', '/api/mobile/profile/complete'],
]);

it('rejects changing the customer number to the saved emergency number', function (string $method, string $endpoint) {
    $user = customerUser(['phone_number' => '09170000001']);
    $user->emergencyContacts()->update(['phone_number' => '0917 000-0002']);
    Sanctum::actingAs($user);

    $this->json($method, $endpoint, [
        'first_name' => 'Changed',
        'phone_number' => '0917 000 0002',
        'driving_intent' => 'owner_driver',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('phone_number')
        ->assertJsonPath('errors.phone_number.0', 'Your phone number must be different from your emergency contact number.');

    expect($user->fresh()->phone_number)->toBe('09170000001')
        ->and($user->customerProfile()->first()->first_name)->toBe('Juan');
})->with('mobile profile phone writes');

it('accepts a distinct customer number through each profile endpoint', function (string $method, string $endpoint) {
    $user = customerUser(['phone_number' => '09170000001']);
    Sanctum::actingAs($user);

    $this->json($method, $endpoint, [
        'phone_number' => '0917 000-0002',
        'driving_intent' => 'owner_driver',
    ])->assertOk();

    expect($user->fresh()->phone_number)->toBe('09170000002');
})->with('mobile profile phone writes');

it('allows a customer number without an emergency contact even if another contact uses it', function () {
    customerUser(['phone_number' => '09170000002']);
    $user = customerUser(['phone_number' => '09170000001']);
    $user->emergencyContacts()->delete();
    Sanctum::actingAs($user);

    $this->putJson('/api/mobile/profile', ['phone_number' => '09123456789'])->assertOk();

    expect($user->fresh()->phone_number)->toBe('09123456789');
});

it('allows unrelated profile edits for historical matching numbers', function () {
    $user = customerUser(['phone_number' => '09123456789']);
    Sanctum::actingAs($user);

    $this->putJson('/api/mobile/profile', ['first_name' => 'Updated'])->assertOk();

    expect($user->fresh()->phone_number)->toBe('09123456789')
        ->and($user->customerProfile()->first()->first_name)->toBe('Updated');
});
