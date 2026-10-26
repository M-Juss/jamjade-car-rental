<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RcNativeRecordingChunk extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['summary' => 'array', 'event_count' => 'integer', 'logical_bytes' => 'integer', 'chunk_index' => 'integer'];
    }
}
