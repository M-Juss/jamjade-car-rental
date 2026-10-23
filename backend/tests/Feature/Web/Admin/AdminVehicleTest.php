<?php

use App\Enums\UserRole;
use App\Enums\VehicleStatus;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\VehicleConfigurationService;
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

it('rejects retired dashcam features on create and update', function (string $feature) {
    $owner = ownerUser();

    $this->actingAs($owner)->postJson('/admin/vehicles', vehiclePayload([
        'features' => ['Air Conditioning', $feature],
    ]))->assertUnprocessable()->assertJsonValidationErrors('features');

    $vehicle = Vehicle::factory()->create();
    $vehicle->features()->create(['feature_name' => 'Air Conditioning']);

    $this->putJson("/admin/vehicles/{$vehicle->id}", [
        'features' => ['Air Conditioning', $feature],
    ])->assertUnprocessable()->assertJsonValidationErrors('features');

    expect($vehicle->fresh()->features->pluck('feature_name')->all())->toBe(['Air Conditioning']);
})->with(['Dashcam', 'dashcam', ' DASHCAM ']);

it('continues to accept non-recording vehicle features', function () {
    $this->actingAs(ownerUser())->postJson('/admin/vehicles', vehiclePayload([
        'features' => ['Reverse Camera', 'GPS Navigation'],
    ]))->assertCreated()->assertJsonPath('data.features', ['GPS Navigation', 'Reverse Camera']);
});

it('lets authorized Admin and Staff select shared custom vehicle features', function (string $role) {
    $admin = ownerUser();
    foreach (['Roof rack', 'Sunroof'] as $name) {
        app(VehicleConfigurationService::class)->save(['section' => 'feature', 'name' => $name, 'is_active' => true], $admin);
    }
    $user = User::factory()->create();
    $user->assignRole($role);

    $response = $this->actingAs($user)->postJson('/admin/vehicles', vehiclePayload([
        'features' => ['Air Conditioning', 'Roof rack'],
    ]))->assertCreated();
    $vehicleId = $response->json('data.id');

    $this->getJson("/admin/vehicles/{$vehicleId}")
        ->assertOk()->assertJsonPath('data.features', ['Air Conditioning', 'Roof rack']);
    $this->putJson("/admin/vehicles/{$vehicleId}", [
        'price_per_day' => 2500,
        'fuel_type' => 'Gasoline',
        'features' => ['Roof rack', 'Sunroof'],
    ])->assertOk()->assertJsonPath('data.features', ['Roof rack', 'Sunroof']);
    $this->getJson("/admin/vehicles/{$vehicleId}")
        ->assertOk()->assertJsonPath('data.features', ['Roof rack', 'Sunroof']);
})->with([UserRole::Admin->value, UserRole::Staff->value]);

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
