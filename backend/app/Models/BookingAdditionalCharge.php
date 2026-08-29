<?php

namespace App\Models;

use App\Enums\AdditionalChargeResponsibility;
use App\Enums\AdditionalChargeType;
use App\Enums\PaymentStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class BookingAdditionalCharge extends Model
{
    protected $fillable = [
        'booking_id', 'type', 'description', 'amount', 'responsibility',
        'responsible_user_id', 'payment_status', 'paid_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'type' => AdditionalChargeType::class,
            'responsibility' => AdditionalChargeResponsibility::class,
            'payment_status' => PaymentStatus::class,
            'amount' => 'decimal:2',
            'paid_at' => 'datetime',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function responsibleUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsible_user_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function paypalCheckouts(): BelongsToMany
    {
        return $this->belongsToMany(
            PayPalCheckout::class,
            'additional_charge_paypal_checkout',
            'booking_additional_charge_id',
            'paypal_checkout_id'
        );
    }
}
