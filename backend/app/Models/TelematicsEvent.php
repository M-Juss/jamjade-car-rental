<?php

namespace App\Models;

use App\Enums\TelematicsEventType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TelematicsEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'trip_id',
        'event_type',
        'severity',
        'latitude',
        'longitude',
        'speed',
        'accelerometer_x',
        'accelerometer_y',
        'accelerometer_z',
        'gyroscope_x',
        'gyroscope_y',
        'gyroscope_z',
        'geofence_status',
        'distance_from_allowed_area',
        'current_area',
        'description',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'event_type' => TelematicsEventType::class,
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'speed' => 'decimal:2',
            'accelerometer_x' => 'decimal:6',
            'accelerometer_y' => 'decimal:6',
            'accelerometer_z' => 'decimal:6',
            'gyroscope_x' => 'decimal:6',
            'gyroscope_y' => 'decimal:6',
            'gyroscope_z' => 'decimal:6',
            'distance_from_allowed_area' => 'decimal:2',
            'occurred_at' => 'datetime',
        ];
    }

    public function trip(): BelongsTo
    {
        return $this->belongsTo(TelematicsTrip::class, 'trip_id');
    }
}
