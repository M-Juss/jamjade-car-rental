<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

class BookingGeofence extends Model
{
    use HasFactory;

    protected $fillable = [
        'booking_id',
        'source_geofence_id',
        'name_snapshot',
        'geometry_type',
        'center_latitude',
        'center_longitude',
        'radius_meters',
        'polygon_coordinates',
        'assigned_by',
        'assigned_at',
    ];

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Booking geofence snapshots are immutable.'));
    }

    protected function casts(): array
    {
        return [
            'center_latitude' => 'decimal:7',
            'center_longitude' => 'decimal:7',
            'radius_meters' => 'decimal:2',
            'polygon_coordinates' => 'array',
            'assigned_at' => 'datetime',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function sourceGeofence(): BelongsTo
    {
        return $this->belongsTo(Geofence::class, 'source_geofence_id');
    }

    public function assignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }
}
