<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingTerms extends Model
{
    use HasFactory;

    protected $fillable = [
        'booking_id',
        'customer_signature',
        'terms_version',
        'accepted_at',
    ];

    protected function casts(): array
    {
        return ['accepted_at' => 'datetime'];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
