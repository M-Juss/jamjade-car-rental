<?php

namespace App\Models;

use App\Enums\TelematicsSetupStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TelematicsSetupSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'booking_id',
        'booking_geofence_id',
        'status',
        'started_at',
        'ready_at',
        'released_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => TelematicsSetupStatus::class,
            'started_at' => 'datetime',
            'ready_at' => 'datetime',
            'released_at' => 'datetime',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function bookingGeofence(): BelongsTo
    {
        return $this->belongsTo(BookingGeofence::class);
    }

    public function steps(): HasMany
    {
        return $this->hasMany(TelematicsSetupStep::class);
    }
}
