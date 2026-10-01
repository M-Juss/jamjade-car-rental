<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Geofence extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'geometry_type',
        'center_latitude',
        'center_longitude',
        'radius_meters',
        'polygon_coordinates',
        'is_active',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'center_latitude' => 'decimal:7',
            'center_longitude' => 'decimal:7',
            'radius_meters' => 'decimal:2',
            'polygon_coordinates' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function bookingSnapshots(): HasMany
    {
        return $this->hasMany(BookingGeofence::class, 'source_geofence_id');
    }
}
