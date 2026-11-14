<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OperationalError extends Model
{
    protected $fillable = ['category', 'booking_id', 'resolved_at', 'resolved_by', 'actor_user_id', 'actor_name', 'action'];

    protected function casts(): array
    {
        return ['resolved_at' => 'datetime'];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class)->withTrashed();
    }
}
