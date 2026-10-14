<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeliveryQuote extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['user_id' => 'integer', 'vehicle_id' => 'integer', 'reviewed_by' => 'integer', 'booking_id' => 'integer', 'duration_days' => 'integer', 'destination_point' => 'encrypted:array', 'pricing_snapshot' => 'array', 'rental_start_at' => 'immutable_datetime', 'rental_end_at' => 'immutable_datetime', 'expires_at' => 'immutable_datetime', 'review_deadline' => 'immutable_datetime', 'point_expires_at' => 'immutable_datetime', 'reviewed_at' => 'immutable_datetime', 'price_per_day' => 'float', 'subtotal' => 'float', 'owner_driver_fee' => 'float', 'delivery_fee' => 'float', 'delivery_toll_fee' => 'float'];
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function total(): float
    {
        return $this->subtotal + $this->owner_driver_fee + $this->delivery_fee + ($this->delivery_toll_fee ?? 0);
    }

    public function effectiveStatus(): string
    {
        if (in_array($this->status, ['offered', 'ready']) && $this->expires_at?->isPast()) {
            return 'expired';
        }
        if ($this->status === 'awaiting_review' && $this->review_deadline?->isPast()) {
            return 'expired';
        }

        return $this->status;
    }
}
