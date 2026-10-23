<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BookingReturn extends Model
{
    protected $guarded = ['id'];

    protected static function booted(): void
    {
        static::updating(function (self $record): void {
            if ($record->getRawOriginal('vehicle_received_at') !== null && $record->isDirty(['vehicle_received_at', 'received_by'])) {
                throw new \LogicException('Physical receipt cannot be overwritten.');
            }
            if ($record->getRawOriginal('late_charge_reviewed_at') !== null && $record->isDirty(['late_charge_reviewed_at', 'approved_late_charge', 'reviewed_by', 'late_charge_id', 'adjustment_reason'])) {
                throw new \LogicException('An approved late charge review cannot be overwritten.');
            }
        });
    }

    protected function casts(): array
    {
        return [
            'vehicle_received_at' => 'immutable_datetime', 'expected_return_at' => 'immutable_datetime',
            'late_charge_reviewed_at' => 'immutable_datetime', 'approved_late_charge' => 'decimal:2',
        ];
    }
}
