<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

class BookingPaymentDocument extends Model
{
    protected $fillable = [
        'booking_id', 'payment_id', 'issued_at', 'context',
        'rental_information_path', 'receipt_path', 'rental_information_filename', 'receipt_filename',
        'delivery_status', 'delivery_token', 'sent_at', 'error',
    ];

    protected function casts(): array
    {
        return [
            'issued_at' => 'immutable_datetime',
            'sent_at' => 'immutable_datetime',
            'context' => 'encrypted:array',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function (self $document): void {
            if ($document->isDirty([
                'booking_id', 'payment_id', 'issued_at', 'context',
                'rental_information_path', 'receipt_path', 'rental_information_filename', 'receipt_filename',
            ])) {
                throw new LogicException('Issued booking documents cannot be changed.');
            }
        });
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }
}
