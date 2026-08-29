<?php

namespace Database\Factories;

use App\Enums\VehicleStatus;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Vehicle> */
class VehicleFactory extends Factory
{
    protected $model = Vehicle::class;

    public function definition(): array
    {
        $brand = fake()->randomElement(['Toyota', 'Honda', 'Mitsubishi', 'Ford']);
        $model = fake()->randomElement(['Vios', 'City', 'Mirage', 'Everest']);

        return [
            'name' => "{$brand} {$model}",
            'brand' => $brand,
            'model' => $model,
            'plate_number' => fake()->unique()->bothify('TST-###???'),
            'price_per_day' => fake()->numberBetween(1800, 7000),
            'seats' => fake()->randomElement([4, 5, 7]),
            'transmission' => fake()->randomElement(['Automatic', 'Manual']),
            'fuel_type' => fake()->randomElement(['Gasoline', 'Diesel', 'Hybrid']),
            'color' => fake()->safeColorName(),
            'status' => VehicleStatus::Available,
            'description' => fake()->sentence(),
        ];
    }
}
