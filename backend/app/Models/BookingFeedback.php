<?php

namespace App\Models;

use App\Enums\BookingStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingFeedback extends Model
{
    protected $table = 'booking_feedback';

    protected $fillable = ['customer_id', 'rating', 'comment', 'publication_consented_at', 'publication_consent_version', 'is_featured', 'featured_by', 'featured_at'];

    protected function casts(): array
    {
        return ['rating' => 'integer', 'is_featured' => 'boolean', 'publication_consented_at' => 'datetime', 'featured_at' => 'datetime'];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function scopeCompleted(Builder $query): Builder
    {
        return $query->whereHas('booking', fn (Builder $booking) => $booking->where('status', BookingStatus::Completed));
    }

    public function scopePublishable(Builder $query): Builder
    {
        return $query->completed()->whereNotNull('comment')->whereRaw("TRIM(comment) != ''")
            ->whereHas('customer', fn (Builder $customer) => $customer->where('is_active', true));
    }
}
