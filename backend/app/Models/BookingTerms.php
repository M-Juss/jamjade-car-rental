<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingTerms extends Model
{
    use HasFactory;

    protected static function booted(): void
    {
        static::updating(function (self $terms): void {
            if ($terms->isDirty('late_return_policy') || ($terms->getRawOriginal('rental_context') !== null && $terms->isDirty('rental_context'))) {
                throw new \LogicException('An accepted late return policy cannot be changed.');
            }
        });
    }

    protected $fillable = [
        'booking_id',
        'customer_signature',
        'terms_version',
        'accepted_at',
        'late_return_policy',
        'rental_context',
    ];

    protected function casts(): array
    {
        return ['accepted_at' => 'datetime', 'late_return_policy' => 'array', 'rental_context' => 'encrypted:array'];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
