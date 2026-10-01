<?php

namespace Database\Factories;

use App\Models\BookingGeofence;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<BookingGeofence> */
class BookingGeofenceFactory extends Factory
{
    protected $model = BookingGeofence::class;

    public function definition(): array
    {
        return [
            'name_snapshot' => fake()->city().' service area',
            'center_latitude' => fake()->latitude(14, 15),
            'center_longitude' => fake()->longitude(120, 121),
            'radius_meters' => fake()->numberBetween(500, 10000),
            'assigned_at' => now(),
        ];
    }
}
