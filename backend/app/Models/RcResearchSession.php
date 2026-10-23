<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RcResearchSession extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['protocol' => 'array', 'added_load_g' => 'integer', 'consented_at' => 'immutable_datetime'];
    }

    public function trials(): HasMany
    {
        return $this->hasMany(RcResearchTrial::class, 'session_id');
    }
}
