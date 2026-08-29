<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

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

    public function additionalCharges(): BelongsToMany
    {
        return $this->belongsToMany(
            BookingAdditionalCharge::class,
            'additional_charge_paypal_checkout',
            'paypal_checkout_id',
            'booking_additional_charge_id'
        );
    }
}
