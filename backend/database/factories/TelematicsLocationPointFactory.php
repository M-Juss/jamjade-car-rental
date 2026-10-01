<?php

namespace Database\Factories;

use App\Models\TelematicsLocationPoint;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<TelematicsLocationPoint> */
class TelematicsLocationPointFactory extends Factory
{
    protected $model = TelematicsLocationPoint::class;

    public function definition(): array
    {
        return [
            'latitude' => fake()->latitude(14, 15),
            'longitude' => fake()->longitude(120, 121),
            'accuracy' => fake()->randomFloat(2, 1, 25),
            'speed' => fake()->randomFloat(2, 0, 100),
            'heading' => fake()->randomFloat(2, 0, 360),
            'captured_at' => now()->subSeconds(5),
            'received_at' => now(),
        ];
    }
}
