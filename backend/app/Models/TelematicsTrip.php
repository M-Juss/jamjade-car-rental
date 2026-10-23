<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TelematicsTrip extends Model
{
    use HasFactory;

    protected $fillable = [
        'latest_location',
        'location_consent_at',
        'location_consent_version',
        'location_session_hash',
        'booking_id',
        'operator_user_id',
        'status',
        'started_at',
        'paused_at',
        'resumed_at',
        'ended_at',
        'start_latitude',
        'start_longitude',
        'end_latitude',
        'end_longitude',
        'current_latitude',
        'current_longitude',
        'current_speed',
        'battery_percent',
        'gps_signal_percent',
        'last_location_at',
    ];

    protected $hidden = ['latest_location', 'location_session_hash'];

    protected function casts(): array
    {
        return [
            'latest_location' => 'encrypted:array',
            'location_consent_at' => 'datetime',
            'location_consent_version' => 'integer',
            'started_at' => 'datetime',
            'paused_at' => 'datetime',
            'resumed_at' => 'datetime',
            'ended_at' => 'datetime',
            'last_location_at' => 'datetime',
            'start_latitude' => 'decimal:7',
            'start_longitude' => 'decimal:7',
            'end_latitude' => 'decimal:7',
            'end_longitude' => 'decimal:7',
            'current_latitude' => 'decimal:7',
            'current_longitude' => 'decimal:7',
            'current_speed' => 'decimal:2',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function operator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'operator_user_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(TelematicsEvent::class, 'trip_id');
    }

    public function geofenceStates(): HasMany
    {
        return $this->hasMany(TelematicsGeofenceState::class);
    }

    public function locationPoints(): HasMany
    {
        return $this->hasMany(TelematicsLocationPoint::class, 'telematics_trip_id');
    }
}
