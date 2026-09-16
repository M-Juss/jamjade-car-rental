<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingAssignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'booking_id',
        'driver_id',
        'assigned_at',
        'calibration_status',
        'calibrated_by',
        'calibrated_at',
    ];

    protected function casts(): array
    {
        return [
            'assigned_at' => 'datetime',
            'calibrated_at' => 'datetime',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_id');
    }

    public function calibratedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'calibrated_by');
    }
}
