<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BookingCancellation extends Model
{
    protected $fillable = [
        'booking_id', 'kind', 'reason', 'recorded_by', 'refund_amount', 'refund_reason',
        'reviewed_by', 'reviewed_at', 'refunded_by', 'refunded_at',
    ];

    protected function casts(): array
    {
        return ['refund_amount' => 'decimal:2', 'reviewed_at' => 'immutable_datetime', 'refunded_at' => 'immutable_datetime'];
    }
}
