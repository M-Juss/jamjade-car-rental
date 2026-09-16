<?php

namespace App\Models;

use App\Enums\MaintenanceCategory;
use App\Enums\MaintenanceRecordStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VehicleMaintenanceRecord extends Model
{
    use HasFactory;

    protected $fillable = [
        'vehicle_id', 'maintenance_plan_id', 'category', 'title', 'description', 'status',
        'scheduled_start', 'scheduled_end', 'actual_started_at', 'completed_at', 'cancelled_at',
        'odometer_at_start', 'odometer_at_completion', 'service_provider', 'technician',
        'labor_cost', 'parts_cost', 'other_cost', 'work_performed', 'notes',
        'cancellation_reason', 'condition_verification_required', 'completion_details_recorded_at',
        'created_by', 'started_by', 'completed_by', 'cancelled_by', 'resulting_condition_inspection_id',
    ];

    protected function casts(): array
    {
        return [
            'category' => MaintenanceCategory::class,
            'status' => MaintenanceRecordStatus::class,
            'scheduled_start' => 'datetime', 'scheduled_end' => 'datetime',
            'actual_started_at' => 'datetime', 'completed_at' => 'datetime', 'cancelled_at' => 'datetime',
            'completion_details_recorded_at' => 'datetime',
            'condition_verification_required' => 'boolean',
            'labor_cost' => 'decimal:2', 'parts_cost' => 'decimal:2', 'other_cost' => 'decimal:2',
        ];
    }

    public function getTotalCostAttribute(): string
    {
        return number_format(
            (float) ($this->labor_cost ?? 0)
            + (float) ($this->parts_cost ?? 0)
            + (float) ($this->other_cost ?? 0),
            2,
            '.',
            ''
        );
    }

    public function scopeBlockingInterval(
        Builder $query,
        mixed $dayStart,
        mixed $dayEnd,
        mixed $preciseStart = null,
        mixed $preciseEnd = null
    ): Builder {
        $preciseStart ??= $dayStart;
        $preciseEnd ??= $dayEnd;

        return $query->where(function (Builder $query) use ($dayStart, $dayEnd, $preciseStart, $preciseEnd) {
            $query->where(function (Builder $query) use ($dayStart, $dayEnd) {
                $query->where('status', MaintenanceRecordStatus::Scheduled->value)
                    ->where('scheduled_start', '<=', $dayEnd)->where('scheduled_end', '>=', $dayStart);
            })->orWhere(function (Builder $query) use ($dayEnd) {
                $query->where('status', MaintenanceRecordStatus::InProgress->value)
                    ->where('scheduled_start', '<=', $dayEnd);
            })->orWhere(function (Builder $query) use ($preciseStart, $preciseEnd) {
                $query->where('status', MaintenanceRecordStatus::Completed->value)
                    ->whereNotNull('completed_at')
                    ->where('scheduled_start', '<=', $preciseEnd)
                    ->where('completed_at', '>=', $preciseStart);
            });
        });
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(VehicleMaintenancePlan::class, 'maintenance_plan_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function starter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'started_by');
    }

    public function completer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }

    public function canceller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    public function resultingConditionInspection(): BelongsTo
    {
        return $this->belongsTo(VehicleInspection::class, 'resulting_condition_inspection_id');
    }
}
