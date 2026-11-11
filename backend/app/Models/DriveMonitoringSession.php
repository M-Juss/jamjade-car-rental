<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DriveMonitoringSession extends Model
{
    use HasUuids;

    protected $guarded = [];

    public function researchSession(): BelongsTo
    {
        return $this->belongsTo(RcCollectionSession::class, 'research_session_id');
    }

    protected function casts(): array
    {
        return ['coverage_version' => 'integer', 'consented_at' => 'immutable_datetime', 'ended_at' => 'immutable_datetime', 'capture_started_ms' => 'integer', 'capture_closed_ms' => 'integer', 'runtime_reference' => 'encrypted:array'];
    }
}
