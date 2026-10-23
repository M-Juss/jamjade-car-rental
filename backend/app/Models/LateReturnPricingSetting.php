<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LateReturnPricingSetting extends Model
{
    protected $fillable = ['id', 'small_vehicle_hourly_rate', 'large_vehicle_hourly_rate'];

    protected function casts(): array
    {
        return ['small_vehicle_hourly_rate' => 'decimal:2', 'large_vehicle_hourly_rate' => 'decimal:2'];
    }

    public static function current(): self
    {
        return static::firstOrCreate(['id' => 1], ['small_vehicle_hourly_rate' => 200, 'large_vehicle_hourly_rate' => 300]);
    }
}
