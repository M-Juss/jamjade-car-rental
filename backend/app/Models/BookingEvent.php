<?php

namespace App\Models;

use App\Enums\BookingStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'booking_id',
        'event_type',
        'old_status',
        'new_status',
        'actor_user_id',
        'reason',
        'changed_by',
    ];

    protected function casts(): array
    {
        return [
            'old_status' => BookingStatus::class,
            'new_status' => BookingStatus::class,
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function getChangedByAttribute(): ?int
    {
        return $this->actor_user_id;
    }

    public function setChangedByAttribute(mixed $value): void
    {
        $this->attributes['actor_user_id'] = $value;
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    public function changedBy(): BelongsTo
    {
        return $this->actor();
    }
}
