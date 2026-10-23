<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class RcResearchTrial extends Model
{
    use HasUuids, SoftDeletes;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['summary' => 'array', 'started_at' => 'immutable_datetime', 'ended_at' => 'immutable_datetime',
            'event_start_ms' => 'integer', 'event_end_ms' => 'integer'];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(RcResearchSession::class, 'session_id');
    }
}
