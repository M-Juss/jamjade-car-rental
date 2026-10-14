<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

class DeliveryPricingSetting extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['minimum_fee' => 'float', 'included_km' => 'float', 'per_km_rate' => 'float', 'garage_latitude' => 'float', 'garage_longitude' => 'float'];
    }

    public static function current(): self
    {
        return static::firstOrCreate(['id' => 1])->refresh();
    }

    public function snapshot(): array
    {
        return $this->only(['minimum_fee', 'included_km', 'per_km_rate', 'garage_address', 'garage_latitude', 'garage_longitude']);
    }

    public function fee(int $meters): float
    {
        $fee = round($this->minimum_fee + max(0, $meters / 1000 - $this->included_km) * $this->per_km_rate, 0, PHP_ROUND_HALF_UP);
        if ($fee >= 10000000000) {
            throw ValidationException::withMessages(['destination' => ['The delivery price exceeds the supported payment amount. Ask staff to check the pricing settings.']]);
        }

        return $fee;
    }
}
