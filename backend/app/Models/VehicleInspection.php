<?php

namespace App\Models;

use App\Enums\VehicleConditionUpdateReason;
use App\Enums\VehicleInspectionStatus;
use App\Enums\VehicleInspectionType;
use Database\Factories\VehicleInspectionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use LogicException;

class VehicleInspection extends Model
{
    /** @use HasFactory<VehicleInspectionFactory> */
    use HasFactory;

    protected $fillable = [
        'vehicle_id',
        'booking_id',
        'type',
        'status',
        'odometer',
        'fuel_level',
        'comments',
        'condition_update_reason',
        'condition_update_notes',
        'based_on_inspection_id',
        'created_by',
        'finalized_at',
    ];

    protected function casts(): array
    {
        return [
            'type' => VehicleInspectionType::class,
            'status' => VehicleInspectionStatus::class,
            'condition_update_reason' => VehicleConditionUpdateReason::class,
            'odometer' => 'integer',
            'fuel_level' => 'integer',
            'finalized_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function (VehicleInspection $inspection): void {
            if ($inspection->getRawOriginal('status') === VehicleInspectionStatus::Finalized->value) {
                throw new LogicException('Finalized vehicle inspections cannot be changed.');
            }
        });

        static::deleting(function (VehicleInspection $inspection): void {
            if ($inspection->status === VehicleInspectionStatus::Finalized) {
                throw new LogicException('Finalized vehicle inspections cannot be deleted.');
            }
        });
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function basedOnInspection(): BelongsTo
    {
        return $this->belongsTo(self::class, 'based_on_inspection_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(VehicleInspectionItem::class, 'inspection_id');
    }

    public function markers(): HasMany
    {
        return $this->hasMany(VehicleInspectionMarker::class, 'inspection_id')->orderBy('sequence_number');
    }

    public function signatures(): HasMany
    {
        return $this->hasMany(VehicleInspectionSignature::class, 'inspection_id');
    }
}
