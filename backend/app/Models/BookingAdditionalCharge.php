<?php

namespace App\Models;

use App\Enums\AdditionalChargeResponsibility;
use App\Enums\AdditionalChargeType;
use App\Enums\PaymentStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class BookingAdditionalCharge extends Model
{
    protected $fillable = [
        'booking_id', 'type', 'description', 'amount', 'responsibility',
        'responsible_user_id', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'type' => AdditionalChargeType::class,
            'responsibility' => AdditionalChargeResponsibility::class,
            'amount' => 'decimal:2',
        ];
    }

    public function getPaymentStatusAttribute(): PaymentStatus
    {
        $paid = $this->completedPaymentAmount();

        return match (true) {
            $paid >= (float) $this->amount => PaymentStatus::Paid,
            $paid > 0 => PaymentStatus::Partial,
            default => PaymentStatus::Unpaid,
        };
    }

    public function getPaidAtAttribute(): mixed
    {
        if ($this->payment_status !== PaymentStatus::Paid) {
            return null;
        }

        $paidAt = $this->relationLoaded('payments')
            ? $this->payments
                ->where('status', 'completed')
                ->sortByDesc('completed_at')
                ->first()?->completed_at
            : $this->payments()
                ->where('payments.status', 'completed')
                ->latest('payments.completed_at')
                ->value('payments.completed_at');

        return $paidAt ? $this->asDateTime($paidAt) : null;
    }

    public function getOutstandingAmountAttribute(): string
    {
        return number_format(
            max((float) $this->amount - $this->completedPaymentAmount(), 0),
            2,
            '.',
            ''
        );
    }

    public function scopeOutstanding(Builder $query): Builder
    {
        return $query->whereRaw(
            '(select coalesce(sum(payment_charge_allocations.amount), 0) '
            .'from payment_charge_allocations '
            .'join payments on payments.id = payment_charge_allocations.payment_id '
            .'where payment_charge_allocations.booking_additional_charge_id = booking_additional_charges.id '
            .'and payments.status = ?) < booking_additional_charges.amount',
            ['completed']
        );
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function responsibleUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsible_user_id')->withTrashed();
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by')->withTrashed();
    }

    public function payments(): BelongsToMany
    {
        return $this->belongsToMany(
            Payment::class,
            'payment_charge_allocations',
            'booking_additional_charge_id',
            'payment_id'
        )->withPivot('amount')->withTimestamps();
    }

    public function paypalCheckouts(): BelongsToMany
    {
        return $this->belongsToMany(
            PayPalCheckout::class,
            'payment_charge_allocations',
            'booking_additional_charge_id',
            'payment_id'
        )->withPivot('amount')->withTimestamps();
    }

    private function completedPaymentAmount(): float
    {
        if ($this->relationLoaded('payments')) {
            return (float) $this->payments
                ->where('status', 'completed')
                ->sum(fn (Payment $payment) => (float) $payment->pivot->amount);
        }

        return (float) $this->payments()
            ->where('payments.status', 'completed')
            ->sum('payment_charge_allocations.amount');
    }
}
