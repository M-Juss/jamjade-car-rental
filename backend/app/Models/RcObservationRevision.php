<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RcObservationRevision extends Model
{
    public const UPDATED_AT = null;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['payload' => 'encrypted:array'];
    }
}
