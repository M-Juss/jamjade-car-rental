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
        'metadata',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'event_type' => TelematicsEventType::class,
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'metadata' => 'array',
            'occurred_at' => 'datetime',
        ];
    }

    public function trip(): BelongsTo
    {
        return $this->belongsTo(TelematicsTrip::class, 'trip_id');
    }
}
