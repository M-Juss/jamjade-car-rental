<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RcProcessingRun extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['cutoff_hz' => 'integer'];
    }

    public function recording(): BelongsTo
    {
        return $this->belongsTo(RcNativeRecording::class, 'recording_id');
    }

    public function referenceRun(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reference_run_id');
    }
}
