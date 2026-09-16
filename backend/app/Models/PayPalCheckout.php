<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;

class PayPalCheckout extends Payment
{
    protected $table = 'payments';

    protected $fillable = [
        'booking_id',
        'user_id',
        'provider',
        'purpose',
        'status',
        'provider_order_id',
        'provider_transaction_id',
        'provider_response',
        'completed_at',
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
            'provider_response' => 'array',
            'completed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::addGlobalScope('paypal', fn (Builder $query) => $query->where('provider', 'paypal'));
        static::creating(function (PayPalCheckout $checkout): void {
            $checkout->provider = 'paypal';
        });
    }

    public function getPaypalOrderIdAttribute(): ?string
    {
        return $this->provider_order_id;
    }

    public function setPaypalOrderIdAttribute(?string $value): void
    {
        $this->attributes['provider_order_id'] = $value;
    }

    public function getPaypalCaptureIdAttribute(): ?string
    {
        return $this->provider_transaction_id;
    }

    public function setPaypalCaptureIdAttribute(?string $value): void
    {
        $this->attributes['provider_transaction_id'] = $value;
    }

    public function getPaymentOptionAttribute(): ?string
    {
        return $this->purpose;
    }

    public function setPaymentOptionAttribute(?string $value): void
    {
        $this->attributes['purpose'] = $value;
    }

    public function getPaypalResponseAttribute(): ?array
    {
        return $this->provider_response;
    }

    public function setPaypalResponseAttribute(?array $value): void
    {
        $this->attributes['provider_response'] = $value === null ? null : json_encode($value);
    }

    public function getCapturedAtAttribute(): mixed
    {
        return $this->completed_at;
    }

    public function setCapturedAtAttribute(mixed $value): void
    {
        $this->attributes['completed_at'] = $value;
    }
}
