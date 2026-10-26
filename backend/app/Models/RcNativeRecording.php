<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RcNativeRecording extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['summary' => 'array', 'duration_ms' => 'float', 'expected_bytes' => 'integer',
            'expected_chunks' => 'integer', 'started_at' => 'immutable_datetime', 'verified_at' => 'immutable_datetime'];
    }

    public function chunks(): HasMany
    {
        return $this->hasMany(RcNativeRecordingChunk::class, 'recording_id');
    }
}
