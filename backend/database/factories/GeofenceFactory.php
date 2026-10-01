<?php

namespace Database\Factories;

use App\Models\Geofence;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Geofence> */
class GeofenceFactory extends Factory
{
    protected $model = Geofence::class;

    public function definition(): array
    {
        return [
            'name' => fake()->unique()->city().' service area',
            'center_latitude' => fake()->latitude(14, 15),
            'center_longitude' => fake()->longitude(120, 121),
            'radius_meters' => fake()->numberBetween(500, 10000),
            'is_active' => true,
        ];
    }
}
