<?php

namespace Database\Factories;

use App\Enums\VehicleInspectionStatus;
use App\Enums\VehicleInspectionType;
use App\Models\Vehicle;
use App\Models\VehicleInspection;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<VehicleInspection> */
class VehicleInspectionFactory extends Factory
{
    protected $model = VehicleInspection::class;

    public function definition(): array
    {
        return [
            'vehicle_id' => Vehicle::factory(),
            'type' => VehicleInspectionType::Initial,
            'status' => VehicleInspectionStatus::Draft,
            'odometer' => fake()->numberBetween(0, 250000),
            'fuel_level' => fake()->numberBetween(0, 8),
            'comments' => fake()->optional()->sentence(),
        ];
    }
}
