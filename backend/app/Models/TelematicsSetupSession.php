<?php

namespace App\Models;

use App\Enums\TelematicsSetupStatus;
use App\Enums\TelematicsSetupStepType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class TelematicsSetupSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'booking_id',
        'status',
        'started_at',
        'ready_at',
        'released_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => TelematicsSetupStatus::class,
            'started_at' => 'datetime',
            'ready_at' => 'datetime',
            'released_at' => 'datetime',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function steps(): HasMany
    {
        return $this->hasMany(TelematicsSetupStep::class);
    }

    public function latestStationary(): HasOne
    {
        return $this->hasOne(TelematicsSetupStep::class)->ofMany(['id' => 'max'], function (Builder $query) {
            $query->where('step_type', TelematicsSetupStepType::StationaryCalibration->value);
        });
    }
}
