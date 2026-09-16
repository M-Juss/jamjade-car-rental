<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingConfirmationEmail extends Model
{
    use HasFactory;

    protected $fillable = [
        'booking_id',
        'sent_at',
        'status',
        'error',
    ];

    protected function casts(): array
    {
        return ['sent_at' => 'datetime'];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
