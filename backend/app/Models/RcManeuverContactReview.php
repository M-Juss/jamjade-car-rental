<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RcManeuverContactReview extends Model
{
    protected $primaryKey = 'recording_id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['first_contact_ms' => 'integer'];
    }
}
