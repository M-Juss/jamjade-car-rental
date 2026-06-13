<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GeofenceLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'trip_id',
        'booking_id',
        'user_id',
        'vehicle_id',
        'status',
        'latitude',
        'longitude',
        'distance_from_allowed_area',
        'current_area',
        'allowed_area',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'distance_from_allowed_area' => 'decimal:2',
            'occurred_at' => 'datetime',
        ];
    }

    public function trip(): BelongsTo
    {
        return $this->belongsTo(TelematicsTrip::class, 'trip_id');
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }
}
