<?php

namespace App\Models;

use App\Enums\MaintenanceCategory;
use App\Enums\MaintenanceTriggerType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VehicleMaintenancePlan extends Model
{
    use HasFactory;

    protected $fillable = [
        'vehicle_id', 'name', 'category', 'description', 'trigger_type', 'interval_km',
        'interval_days', 'last_completed_at', 'last_completed_odometer', 'next_due_date',
        'next_due_odometer', 'is_active', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'category' => MaintenanceCategory::class,
            'trigger_type' => MaintenanceTriggerType::class,
            'last_completed_at' => 'datetime',
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

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
