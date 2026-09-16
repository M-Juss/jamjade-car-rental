<?php

namespace App\Models;

use App\Enums\PaymentStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Str;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'booking_id',
        'user_id',
        'provider',
        'purpose',
        'status',
        'currency',
        'provider_order_id',
        'provider_transaction_id',
        'approval_url',
        'provider_response',
        'proof_path',
        'completed_at',
        'failed_at',
        // Virtual domain inputs retained by the model while storage stays normalized.
        'payment_method',
        'payment_status',
        'amount',
        'transaction_id',
        'paid_at',
        'proof_of_payment',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'provider_response' => 'array',
            'completed_at' => 'datetime',
            'failed_at' => 'datetime',
        ];
    }

    public function getPaymentMethodAttribute(): string
    {
        return match ($this->provider) {
            'paypal' => 'PayPal',
            'manual' => 'Manual',
            default => Str::headline((string) $this->provider),
        };
    }

    public function setPaymentMethodAttribute(mixed $value): void
    {
        $normalized = Str::of((string) $value)->trim()->lower()->replace(' ', '_')->toString();
        $this->attributes['provider'] = $normalized === 'paypal' ? 'paypal' : ($normalized ?: 'manual');
    }

    public function getPaymentStatusAttribute(): PaymentStatus
    {
        return match ($this->status) {
            'completed' => PaymentStatus::Paid,
            'failed' => PaymentStatus::Failed,
            'refunded' => PaymentStatus::Refunded,
            default => PaymentStatus::Pending,
        };
    }

    public function setPaymentStatusAttribute(PaymentStatus|string $value): void
    {
        $value = $value instanceof PaymentStatus ? $value : PaymentStatus::from($value);
        $this->attributes['status'] = match ($value) {
            PaymentStatus::Paid, PaymentStatus::Partial => 'completed',
            PaymentStatus::Failed => 'failed',
            PaymentStatus::Refunded => 'refunded',
            default => 'pending',
        };
    }

    public function getTransactionIdAttribute(): ?string
    {
        return $this->provider_transaction_id;
    }

    public function setTransactionIdAttribute(?string $value): void
    {
        $this->attributes['provider_transaction_id'] = $value;
    }

    public function getPaidAtAttribute(): mixed
    {
        return $this->completed_at;
    }

    public function setPaidAtAttribute(mixed $value): void
    {
        $this->attributes['completed_at'] = $value;
    }

    public function getProofOfPaymentAttribute(): ?string
    {
        return $this->proof_path;
    }

    public function setProofOfPaymentAttribute(?string $value): void
    {
        $this->attributes['proof_path'] = $value;
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
            'payment_charge_allocations',
            'payment_id',
            'booking_additional_charge_id'
        )->withPivot('amount')->withTimestamps();
    }
}
