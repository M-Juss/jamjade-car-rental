<?php

namespace App\Models;

use App\Enums\MaintenanceCategory;
use App\Enums\MaintenanceTriggerType;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class VehicleMaintenancePlan extends Model
{
    use HasFactory;

    protected $fillable = [
        'vehicle_id', 'name', 'category', 'description', 'trigger_type', 'interval_km',
        'interval_days', 'baseline_odometer', 'baseline_date', 'next_due_date',
        'next_due_odometer', 'is_active', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'category' => MaintenanceCategory::class,
            'trigger_type' => MaintenanceTriggerType::class,
            'baseline_date' => 'date',
            'next_due_date' => 'date',
            'is_active' => 'boolean',
        ];
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function records(): HasMany
    {
        return $this->hasMany(VehicleMaintenanceRecord::class, 'maintenance_plan_id');
    }

    public function activeRecord(): HasOne
    {
        return $this->hasOne(VehicleMaintenanceRecord::class, 'maintenance_plan_id')
            ->whereIn('status', ['scheduled', 'in_progress'])
            ->latestOfMany();
    }

    public function lastCompletedRecord(): HasOne
    {
        return $this->hasOne(VehicleMaintenanceRecord::class, 'maintenance_plan_id')
            ->where('status', 'completed')
            ->latestOfMany('completed_at');
    }

    public function getLastCompletedAtAttribute(): mixed
    {
        $value = $this->relationLoaded('lastCompletedRecord')
            ? $this->lastCompletedRecord?->completed_at
            : $this->lastCompletedRecord()->value('completed_at');

        return is_string($value) ? CarbonImmutable::parse($value) : $value;
    }

    public function getLastCompletedOdometerAttribute(): ?int
    {
        $value = $this->relationLoaded('lastCompletedRecord')
            ? $this->lastCompletedRecord?->odometer_at_completion
            : $this->lastCompletedRecord()->value('odometer_at_completion');

        return $value === null ? null : (int) $value;
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
