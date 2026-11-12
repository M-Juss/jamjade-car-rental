<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RentalDrivingReport extends Model
{
    public $timestamps = false;

    protected $fillable = ['booking_id', 'score', 'confirmed_events', 'snapshot', 'finalized_at'];

    protected function casts(): array
    {
        return ['score' => 'integer', 'confirmed_events' => 'integer', 'snapshot' => 'array', 'finalized_at' => 'immutable_datetime'];
    }
}
