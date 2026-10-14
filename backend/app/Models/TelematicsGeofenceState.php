<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TelematicsGeofenceState extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'inside' => 'boolean', 'uncertain' => 'boolean', 'candidate_inside' => 'boolean',
            'candidate_started_at' => 'datetime', 'last_captured_at' => 'datetime',
        ];
    }

    public function zone(): BelongsTo
    {
        return $this->belongsTo(BookingGeofence::class, 'booking_geofence_id');
    }
}
