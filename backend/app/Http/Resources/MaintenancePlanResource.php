<?php

namespace App\Http\Resources;

use App\Support\MaintenanceDueCalculator;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MaintenancePlanResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $currentOdometer = $this->vehicle?->currentCondition?->odometer;
        $due = app(MaintenanceDueCalculator::class)->calculate($this->resource, $currentOdometer);

        return [
            'id' => (string) $this->id, 'vehicleId' => (string) $this->vehicle_id,
            'vehicle' => $this->whenLoaded('vehicle', fn () => ['id' => (string) $this->vehicle->id, 'name' => $this->vehicle->name, 'plateNumber' => $this->vehicle->plate_number]),
            'name' => $this->name, 'category' => $this->category->value, 'categoryLabel' => $this->category->label(),
            'description' => $this->description, 'triggerType' => $this->trigger_type->value,
            'intervalKm' => $this->interval_km, 'intervalDays' => $this->interval_days,
            'baselineOdometer' => $this->baseline_odometer, 'baselineDate' => $this->baseline_date?->toDateString(),
            'lastCompletedAt' => $this->last_completed_at?->toISOString(), 'lastCompletedOdometer' => $this->last_completed_odometer,
            'nextDueDate' => $this->next_due_date?->toDateString(), 'nextDueOdometer' => $this->next_due_odometer,
            'currentOdometer' => $currentOdometer, 'dueStatus' => $due['status']->value,
            'dueStatusLabel' => $due['status']->label(), 'mileageRemaining' => $due['mileage_remaining'],
            'daysRemaining' => $due['days_remaining'], 'isActive' => $this->is_active,
            'hasHistory' => isset($this->records_count) ? $this->records_count > 0 : null,
            'activeRecord' => $this->whenLoaded('activeRecord', fn () => $this->activeRecord ? [
                'id' => (string) $this->activeRecord->id,
                'status' => $this->activeRecord->status->value,
                'statusLabel' => $this->activeRecord->status->label(),
            ] : null),
            'createdAt' => $this->created_at?->toISOString(),
        ];
    }
}
