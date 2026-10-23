<?php

use App\Models\User;
use App\Models\VehicleConfigurationOption;
use App\Services\VehicleInspectionService;
use App\Services\VehicleService;
use App\Support\VehicleInspectionDefinition;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Storage::fake('local');
});

function configurationAdmin(): User
{
    return vehicleManagerUser();
}

it('allows operational staff to read options but only Admin to configure them', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $option = VehicleConfigurationOption::firstOrFail();
    $this->actingAs($staff)->getJson('/admin/vehicle-options')->assertOk()->assertJsonCount(9, 'data.checklist.exterior');
    $this->getJson('/admin/vehicle-configuration')->assertForbidden();
    $this->postJson('/admin/vehicle-configuration', ['section' => 'brand', 'name' => 'Test brand', 'is_active' => true])->assertForbidden();
    $this->putJson("/admin/vehicle-configuration/{$option->id}", ['name' => 'Changed', 'is_active' => true])->assertForbidden();
    $this->deleteJson("/admin/vehicle-configuration/{$option->id}")->assertForbidden();
    $customer = User::factory()->create();
    $customer->assignRole('customer');
    $this->actingAs($customer)->getJson('/admin/vehicle-options')->assertForbidden();
});

it('creates edits and deletes an unused option with duplicate validation', function (string $section) {
    $this->actingAs(configurationAdmin());
    $created = $this->postJson('/admin/vehicle-configuration', ['section' => $section, 'name' => ' Test choice ', 'is_active' => true])
        ->assertCreated()->assertJsonPath('data.name', 'Test choice')->assertJsonPath('data.in_use', false);
    $id = $created->json('data.id');
    $key = $created->json('data.key');
    $this->postJson('/admin/vehicle-configuration', ['section' => $section, 'name' => 'TEST CHOICE', 'is_active' => true])
        ->assertUnprocessable()->assertJsonValidationErrors('name');
    $this->putJson("/admin/vehicle-configuration/{$id}", ['name' => 'Renamed choice', 'is_active' => true])
        ->assertOk()->assertJsonPath('data.key', $key);
    $this->deleteJson("/admin/vehicle-configuration/{$id}")->assertOk();
    $this->assertDatabaseMissing('vehicle_configuration_options', ['id' => $id]);
})->with(['brand', 'feature', 'transmission', 'fuel_type', 'exterior', 'interior', 'equipment']);

it('validates section length retired features and active state', function () {
    $this->actingAs(configurationAdmin());
    foreach ([
        ['section' => 'status', 'name' => 'Something', 'is_active' => true],
        ['section' => 'brand', 'name' => str_repeat('a', 81), 'is_active' => true],
        ['section' => 'transmission', 'name' => str_repeat('a', 41), 'is_active' => true],
        ['section' => 'fuel_type', 'name' => str_repeat('a', 41), 'is_active' => true],
        ['section' => 'feature', 'name' => ' DASHCAM ', 'is_active' => true],
        ['section' => 'feature', 'name' => ['invalid'], 'is_active' => true],
        ['section' => 'feature', 'name' => 'Valid', 'is_active' => 'invalid'],
    ] as $payload) {
        $this->postJson('/admin/vehicle-configuration', $payload)->assertUnprocessable();
    }
});

it('preserves saved names through rename deactivation and unrelated edits', function () {
    $admin = configurationAdmin();
    $vehicle = availableVehicle(['brand' => 'Toyota']);
    $vehicle->features()->create(['feature_name' => 'Bluetooth']);
    $brand = VehicleConfigurationOption::where('section', 'brand')->where('name', 'Toyota')->firstOrFail();
    $this->actingAs($admin)->putJson("/admin/vehicle-configuration/{$brand->id}", ['name' => 'Toyota Motors', 'is_active' => true])
        ->assertOk()->assertJsonPath('data.in_use', true);
    expect($vehicle->fresh()->brand)->toBe('Toyota');
    $this->deleteJson("/admin/vehicle-configuration/{$brand->id}")->assertOk();
    $this->assertDatabaseHas('vehicle_configuration_options', ['id' => $brand->id, 'is_active' => false]);
    $this->putJson("/admin/vehicles/{$vehicle->id}", ['brand' => 'Toyota', 'features' => ['Bluetooth'], 'price_per_day' => 3000])->assertOk();
    $other = availableVehicle(['brand' => 'Honda']);
    $this->putJson("/admin/vehicles/{$other->id}", ['brand' => 'Toyota'])->assertUnprocessable()->assertJsonValidationErrors('brand');
    $this->postJson('/admin/vehicle-configuration', ['section' => 'brand', 'name' => 'Toyota', 'is_active' => true])
        ->assertUnprocessable()->assertJsonValidationErrors('name');
    $this->putJson("/admin/vehicle-configuration/{$brand->id}", ['name' => 'Toyota Motors', 'is_active' => true])->assertOk();
});

it('rejects unconfigured values on vehicle updates including direct service calls', function () {
    $vehicle = availableVehicle();
    $this->actingAs(configurationAdmin())->putJson("/admin/vehicles/{$vehicle->id}", ['transmission' => 'Unknown'])
        ->assertUnprocessable()->assertJsonValidationErrors('transmission');
    $this->putJson("/admin/vehicles/{$vehicle->id}", ['features' => ['Unconfigured feature']])
        ->assertUnprocessable()->assertJsonValidationErrors('features.0');
    expect(fn () => app(VehicleService::class)->update($vehicle, ['fuel_type' => 'Unknown']))
        ->toThrow(ValidationException::class);
});

it('keeps at least one active choice in every section', function () {
    $admin = configurationAdmin();
    $options = VehicleConfigurationOption::where('section', 'transmission')->get();
    $this->actingAs($admin)->deleteJson("/admin/vehicle-configuration/{$options[0]->id}")->assertOk();
    $this->deleteJson("/admin/vehicle-configuration/{$options[1]->id}")->assertUnprocessable()->assertJsonValidationErrors('is_active');
});

it('rejects stale incomplete and unreviewed checklists without altering a finalized snapshot', function () {
    $admin = configurationAdmin();
    $vehicle = availableVehicle();
    $service = app(VehicleInspectionService::class);
    $initial = $service->configureInitial($vehicle, vehicleConditionPayload(), $admin);
    $original = $initial->items()->orderBy('id')->get()->toArray();
    $stale = vehicleConditionPayload();
    $this->actingAs($admin);
    $new = $this->postJson('/admin/vehicle-configuration', ['section' => 'exterior', 'name' => 'Roof rails', 'is_active' => true])
        ->assertCreated()->json('data');
    $this->postJson("/admin/vehicles/{$vehicle->id}/condition-updates", ['reason' => 'issue_discovered', 'condition' => $stale])
        ->assertUnprocessable()->assertJsonValidationErrors('condition.checklist_version');
    expect(fn () => $service->updateCurrentCondition($vehicle, $stale, 'issue_discovered', null, $admin))->toThrow(ValidationException::class);
    $missing = vehicleConditionPayload();
    unset($missing['checklist']['exterior'][$new['key']]);
    $this->postJson("/admin/vehicles/{$vehicle->id}/condition-updates", ['reason' => 'issue_discovered', 'condition' => $missing])
        ->assertUnprocessable()->assertJsonValidationErrors('condition.checklist.exterior.'.$new['key']);
    $unreviewed = vehicleConditionPayload();
    $unreviewed['checklist']['exterior'][$new['key']] = null;
    $this->postJson("/admin/vehicles/{$vehicle->id}/condition-updates", ['reason' => 'issue_discovered', 'condition' => $unreviewed])->assertUnprocessable();
    $this->postJson("/admin/vehicles/{$vehicle->id}/condition-updates", ['reason' => 'issue_discovered', 'condition' => vehicleConditionPayload()])
        ->assertCreated();
    expect($initial->fresh()->items()->orderBy('id')->get()->toArray())->toBe($original);
    expect($vehicle->fresh()->currentCondition->items)->toHaveCount(28);
});

it('snapshots new labels while retaining historical labels and deactivating used checklist items', function () {
    $admin = configurationAdmin();
    $vehicle = availableVehicle();
    $initial = app(VehicleInspectionService::class)->configureInitial($vehicle, vehicleConditionPayload(), $admin);
    $option = VehicleConfigurationOption::where('section', 'exterior')->where('key', 'tire')->firstOrFail();
    $this->actingAs($admin)->putJson("/admin/vehicle-configuration/{$option->id}", ['name' => 'Tires', 'is_active' => true])->assertOk();
    $updated = app(VehicleInspectionService::class)->updateCurrentCondition($vehicle, vehicleConditionPayload(), 'issue_discovered', null, $admin);
    expect($initial->items()->where('item_key', 'tire')->value('item_label'))->toBe('Tire');
    expect($updated->items()->where('item_key', 'tire')->value('item_label'))->toBe('Tires');
    $this->deleteJson("/admin/vehicle-configuration/{$option->id}")->assertOk();
    $this->assertDatabaseHas('vehicle_configuration_options', ['id' => $option->id, 'is_active' => false]);
    expect(VehicleInspectionDefinition::checklist()['exterior'])->not->toHaveKey('tire');
    expect($initial->items()->where('item_key', 'tire')->value('item_label'))->toBe('Tire');
    $next = app(VehicleInspectionService::class)->updateCurrentCondition($vehicle, vehicleConditionPayload(), 'issue_discovered', null, $admin);
    expect($next->items()->where('item_key', 'tire')->exists())->toBeFalse();
});
