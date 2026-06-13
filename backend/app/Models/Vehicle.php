<?php

namespace App\Models;

use App\Enums\VehicleStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Vehicle extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'brand',
        'model',
        'price_per_day',
        'seats',
        'transmission',
        'fuel_type',
        'color',
        'status',
        'is_most_booked',
        'description',
        'last_service_at',
        'next_service_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => VehicleStatus::class,
            'price_per_day' => 'decimal:2',
            'is_most_booked' => 'boolean',
            'last_service_at' => 'datetime',
            'next_service_at' => 'datetime',
        ];
    }

    public function images(): HasMany
    {
        return $this->hasMany(VehicleImage::class)
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    public function features(): HasMany
    {
        return $this->hasMany(VehicleFeature::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function dateBlockingBookings(): HasMany
    {
        return $this->bookings()
            ->blockingVehicleDates()
            ->where('rental_end_at', '>=', today())
            ->orderBy('rental_start_at');
    }
}
