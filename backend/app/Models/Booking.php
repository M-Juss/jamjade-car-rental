<?php

namespace App\Models;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\SoftDeletes;

class Booking extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'booking_code',
        'user_id',
        'vehicle_id',
        'rental_type',
        'rental_start_at',
        'rental_end_at',
        'pickup_location_type',
        'pickup_location',
        'delivery_time',
        'return_location',
        'driver_option',
        'owner_driver_coverage',
        'status',
        'payment_status',
        'price_per_day',
        'duration_days',
        'subtotal',
        'delivery_fee',
        'outside_manila_fee',
        'owner_driver_fee',
        'toll_fee',
        'late_fee',
        'add_ons_total',
        'discount_total',
        'penalty_total',
        'down_payment_amount',
        'remaining_balance',
        'balance_due_at',
        'balance_reminder_sent_at',
        'confirmation_email_sent_at',
        'confirmation_email_status',
        'confirmation_email_error',
        'total_amount',
        'notes',
        'customer_signature',
        'terms_version',
        'terms_accepted_at',
        'admin_notes',
        'confirmed_at',
        'rejected_at',
        'started_at',
        'completed_at',
        'cancelled_at',
    ];

    protected function casts(): array
    {
        return [
            'rental_type' => RentalType::class,
            'status' => BookingStatus::class,
            'payment_status' => PaymentStatus::class,
            'rental_start_at' => 'datetime',
            'rental_end_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'rejected_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'terms_accepted_at' => 'datetime',
            'balance_due_at' => 'datetime',
            'balance_reminder_sent_at' => 'datetime',
            'confirmation_email_sent_at' => 'datetime',
            'price_per_day' => 'decimal:2',
            'subtotal' => 'decimal:2',
            'delivery_fee' => 'decimal:2',
            'outside_manila_fee' => 'decimal:2',
            'owner_driver_fee' => 'decimal:2',
            'toll_fee' => 'decimal:2',
            'late_fee' => 'decimal:2',
            'add_ons_total' => 'decimal:2',
            'discount_total' => 'decimal:2',
            'penalty_total' => 'decimal:2',
            'down_payment_amount' => 'decimal:2',
            'remaining_balance' => 'decimal:2',
            'total_amount' => 'decimal:2',
        ];
    }

    public function scopeBlockingVehicleDates(Builder $query): Builder
    {
        return $query->whereIn('status', [
            BookingStatus::Confirmed->value,
            BookingStatus::Ongoing->value,
        ]);
    }

    public function scopeOverlappingSchedule(Builder $query, mixed $start, mixed $end): Builder
    {
        return $query
            ->where('rental_start_at', '<=', $end)
            ->where('rental_end_at', '>=', $start);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function paypalCheckouts(): HasMany
    {
        return $this->hasMany(PayPalCheckout::class);
    }

    public function statusLogs(): HasMany
    {
        return $this->hasMany(BookingStatusLog::class);
    }

    public function telematicsTrips(): HasMany
    {
        return $this->hasMany(TelematicsTrip::class);
    }

    public function vehicleInspections(): HasMany
    {
        return $this->hasMany(VehicleInspection::class);
    }

    public function telematicsEvents(): HasManyThrough
    {
        return $this->hasManyThrough(TelematicsEvent::class, TelematicsTrip::class, 'booking_id', 'trip_id');
    }
}
