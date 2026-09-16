<?php

use App\Enums\UserRole;
use App\Enums\VehicleStatus;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
});

function ownerUser(): User
{
    $owner = User::factory()->create();
    $owner->assignRole(UserRole::Admin->value);

    return $owner;
}

function vehiclePayload(array $overrides = []): array
{
    return array_merge([
        'name' => 'Toyota Vios XLE',
        'brand' => 'Toyota',
        'model' => 'Vios XLE',
        'plate_number' => 'ABC 1234',
        'price_per_day' => 2500,
        'seats' => 5,
        'transmission' => 'Automatic',
        'fuel_type' => 'Gasoline',
        'color' => 'Pearl White',
        'description' => 'Compact sedan for city rentals.',
        'features' => ['Air Conditioning'],
        'images' => ['vehicles/sample-vios.jpg'],
        'initial_condition' => vehicleConditionPayload(),
    ], $overrides);
}

it('creates vehicles with available status by default', function () {
    $response = $this->actingAs(ownerUser())->postJson('/admin/vehicles', vehiclePayload());

    $response->assertCreated()
        ->assertJsonPath('data.status', VehicleStatus::Available->value)
        ->assertJsonPath('data.statusLabel', 'Available')
        ->assertJsonPath('data.plateNumber', 'ABC 1234');

    $this->assertDatabaseHas('vehicles', [
        'name' => 'Toyota Vios XLE',
        'plate_number' => 'ABC 1234',
        'status' => VehicleStatus::Available->value,
    ]);
});

it('allows owners to create unavailable vehicles', function () {
    $response = $this->actingAs(ownerUser())->postJson('/admin/vehicles', vehiclePayload([
        'name' => 'Toyota Fortuner V',
        'status' => VehicleStatus::Unavailable->value,
    ]));

    $response->assertCreated()
        ->assertJsonPath('data.status', VehicleStatus::Unavailable->value)
        ->assertJsonPath('data.statusLabel', 'Unavailable');

    $this->assertDatabaseHas('vehicles', [
        'name' => 'Toyota Fortuner V',
        'status' => VehicleStatus::Unavailable->value,
    ]);
});

it('stores uploaded vehicle images as public storage paths', function () {
    Storage::fake('public');

    $response = $this->actingAs(ownerUser())->post('/admin/vehicles', vehiclePayload([
        'name' => 'Toyota Altis G',
        'images' => [UploadedFile::fake()->image('altis.jpg', 1, 1)],
    ]));

    $response->assertCreated();

    $imageRecord = $response->json('data.imageRecords.0');

    $this->assertStringStartsWith('vehicles/', $imageRecord['imagePath']);
    $this->assertStringStartsWith(url('/storage/vehicles/'), $imageRecord['url']);
    Storage::disk('public')->assertExists($imageRecord['imagePath']);
});

it('requires the add vehicle form core fields', function () {
    $payload = vehiclePayload([
        'description' => '',
        'plate_number' => '',
        'features' => [],
        'images' => [],
    ]);

    $this->actingAs(ownerUser())->postJson('/admin/vehicles', $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['description', 'plate_number', 'features', 'images']);
});

it('requires unique vehicle plate numbers', function () {
    $owner = ownerUser();

    $this->actingAs($owner)->postJson('/admin/vehicles', vehiclePayload())
        ->assertCreated();

    $this->actingAs($owner)->postJson('/admin/vehicles', vehiclePayload([
        'name' => 'Toyota Vios E',
        'model' => 'Vios E',
    ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('plate_number');
});

it('validates vehicle list filters and pagination limits', function () {
    $this->actingAs(ownerUser())
        ->getJson('/admin/vehicles?status=unknown&per_page=101')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['status', 'per_page']);
});
