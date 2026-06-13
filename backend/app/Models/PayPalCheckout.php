<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayPalCheckout extends Model
{
    protected $table = 'paypal_checkouts';

    protected $fillable = [
        'booking_id',
        'user_id',
        'paypal_order_id',
        'paypal_capture_id',
        'payment_option',
        'amount',
        'currency',
        'status',
        'approval_url',
        'paypal_response',
        'captured_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'paypal_response' => 'array',
            'captured_at' => 'datetime',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
