<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TelematicsLocationPoint extends Model
{
    use HasFactory;

    protected $fillable = [
        'telematics_trip_id',
        'latitude',
        'longitude',
        'accuracy',
        'speed',
        'heading',
        'captured_at',
        'received_at',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'accuracy' => 'decimal:2',
            'speed' => 'decimal:2',
            'heading' => 'decimal:2',
            'captured_at' => 'datetime',
            'received_at' => 'datetime',
        ];
    }

    public function trip(): BelongsTo
    {
        return $this->belongsTo(TelematicsTrip::class, 'telematics_trip_id');
    }
}
