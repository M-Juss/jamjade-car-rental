<?php

namespace App\Models;

use App\Enums\TelematicsSetupStepStatus;
use App\Enums\TelematicsSetupStepType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TelematicsSetupStep extends Model
{
    use HasFactory;

    protected $fillable = [
        'telematics_setup_session_id',
        'step_type',
        'attempt_number',
        'status',
        'started_at',
        'completed_at',
        'failure_reason',
        'evidence',
        'actor_user_id',
    ];

    protected function casts(): array
    {
        return [
            'step_type' => TelematicsSetupStepType::class,
            'status' => TelematicsSetupStepStatus::class,
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'evidence' => 'array',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(TelematicsSetupSession::class, 'telematics_setup_session_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id')->withTrashed();
    }
}
