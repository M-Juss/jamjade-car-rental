<?php

namespace App\Models;

use App\Enums\BookingStatus;
use App\Enums\VehicleStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Vehicle extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'current_condition_inspection_id',
        'brand',
        'model',
        'plate_number',
        'price_per_day',
        'seats',
        'transmission',
        'fuel_type',
        'color',
        'status',
        'is_featured',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'status' => VehicleStatus::class,
            'price_per_day' => 'decimal:2',
            'is_featured' => 'boolean',
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

    public function currentCondition(): BelongsTo
    {
        return $this->belongsTo(VehicleInspection::class, 'current_condition_inspection_id');
    }

    public function inspections(): HasMany
    {
        return $this->hasMany(VehicleInspection::class);
    }

    public function maintenancePlans(): HasMany
    {
        return $this->hasMany(VehicleMaintenancePlan::class);
    }

    public function maintenanceRecords(): HasMany
    {
        return $this->hasMany(VehicleMaintenanceRecord::class);
    }

    public function activeMaintenanceRecords(): HasMany
    {
        return $this->maintenanceRecords()
            ->whereIn('status', ['scheduled', 'in_progress']);
    }

    public function scheduledMaintenanceWindows(): HasMany
    {
        return $this->maintenanceRecords()
            ->where('status', 'scheduled')
            ->where('scheduled_end', '>=', now())
            ->orderBy('scheduled_start');
    }

    public function dateBlockingBookings(): HasMany
    {
        return $this->bookings()
            ->blockingVehicleDates()
            ->where('rental_end_at', '>=', today())
            ->orderBy('rental_start_at');
    }

    public function mobileDateBlockingBookings(): HasMany
    {
        return $this->bookings()->blockingVehicleDates()
            ->where(fn (Builder $query) => $query->where('rental_end_at', '>=', CarbonImmutable::today('Asia/Manila')->utc())
                ->orWhere('status', BookingStatus::Ongoing))
            ->orderBy('rental_start_at');
    }

    public function scopeVisibleInMobileCatalog(Builder $query, ?int $customerId): Builder
    {
        $catalogStatuses = [VehicleStatus::Available, VehicleStatus::Rented];
        if ($customerId === null) {
            return $query->whereIn('status', $catalogStatuses);
        }

        $ownedOpenBookings = fn (Builder $bookings) => $bookings->where('user_id', $customerId)
            ->whereIn('status', [BookingStatus::Pending, BookingStatus::Confirmed, BookingStatus::Ongoing, BookingStatus::Returned]);

        return $query->withExists(['bookings as has_open_customer_booking' => $ownedOpenBookings])
            ->where(fn (Builder $vehicles) => $vehicles->whereIn('status', $catalogStatuses)
                ->orWhereHas('bookings', $ownedOpenBookings));
    }

    public function upcomingConfirmedBookings(): HasMany
    {
        return $this->hasMany(Booking::class)->where('status', 'confirmed')
            ->where('rental_end_at', '>=', now())->orderBy('rental_start_at')->limit(5);
    }

    public function ongoingBookings(): HasMany
    {
        return $this->bookings()
            ->where('status', BookingStatus::Ongoing);
    }
}
