<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingDriverUpdate extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['context' => 'encrypted:array', 'retry_at' => 'datetime', 'sent_at' => 'datetime'];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
