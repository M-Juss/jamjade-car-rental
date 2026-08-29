<?php

use App\Enums\VehicleInspectionStatus;
use App\Enums\VehicleInspectionType;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function domainVehicle(): Vehicle
{
    return Vehicle::create([
        'name' => 'Domain Test Vehicle',
        'brand' => 'Toyota',
        'model' => 'Vios',
        'plate_number' => 'DOM-1234',
        'price_per_day' => 2500,
        'seats' => 5,
        'transmission' => 'Automatic',
        'fuel_type' => 'Gasoline',
        'color' => 'White',
        'status' => 'available',
        'description' => 'Domain relationship test vehicle.',
    ]);
}

it('relates a vehicle to its current inspection and history', function () {
    $vehicle = domainVehicle();
    $inspection = $vehicle->inspections()->create([
        'type' => VehicleInspectionType::Initial,
        'status' => VehicleInspectionStatus::Finalized,
        'odometer' => 1250,
        'fuel_level' => 6,
        'finalized_at' => now(),
    ]);

    $vehicle->update(['current_condition_inspection_id' => $inspection->id]);

    expect($vehicle->fresh()->currentCondition->is($inspection))->toBeTrue()
        ->and($vehicle->inspections()->count())->toBe(1);
});

it('prevents finalized snapshots and child records from being changed', function () {
    $vehicle = domainVehicle();
    $inspection = $vehicle->inspections()->create([
        'type' => VehicleInspectionType::Initial,
        'status' => VehicleInspectionStatus::Draft,
        'odometer' => 1250,
        'fuel_level' => 6,
    ]);
    $item = $inspection->items()->create([
        'category' => 'exterior',
        'item_key' => 'carwash',
        'item_label' => 'Carwash',
        'value' => true,
    ]);
    $inspection->update([
        'status' => VehicleInspectionStatus::Finalized,
        'finalized_at' => now(),
    ]);

    expect(fn () => $inspection->update(['odometer' => 2000]))
        ->toThrow(LogicException::class)
        ->and(fn () => $item->update(['value' => false]))
        ->toThrow(LogicException::class);
});
