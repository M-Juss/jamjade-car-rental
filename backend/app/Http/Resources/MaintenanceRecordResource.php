<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MaintenanceRecordResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id, 'vehicleId' => (string) $this->vehicle_id,
            'vehicle' => $this->whenLoaded('vehicle', fn () => ['id' => (string) $this->vehicle->id, 'name' => $this->vehicle->name, 'plateNumber' => $this->vehicle->plate_number, 'status' => $this->vehicle->status->value, 'currentOdometer' => $this->vehicle->currentCondition?->odometer]),
            'plan' => $this->whenLoaded('plan', fn () => $this->plan ? new MaintenancePlanResource($this->plan) : null),
            'category' => $this->category->value, 'categoryLabel' => $this->category->label(), 'title' => $this->title,
            'description' => $this->description, 'status' => $this->status->value, 'statusLabel' => $this->status->label(),
            'scheduledStart' => $this->scheduled_start?->toISOString(), 'scheduledEnd' => $this->scheduled_end?->toISOString(),
            'actualStartedAt' => $this->actual_started_at?->toISOString(), 'completedAt' => $this->completed_at?->toISOString(),
            'cancelledAt' => $this->cancelled_at?->toISOString(), 'odometerAtStart' => $this->odometer_at_start,
            'odometerAtCompletion' => $this->odometer_at_completion, 'serviceProvider' => $this->service_provider,
            'laborCost' => (float) ($this->labor_cost ?? 0),
            'partsCost' => (float) ($this->parts_cost ?? 0), 'otherCost' => (float) ($this->other_cost ?? 0),
            'totalCost' => (float) $this->total_cost, 'workPerformed' => $this->work_performed, 'notes' => $this->notes,
            'cancellationReason' => $this->cancellation_reason,
            'conditionVerificationRequired' => (bool) $this->condition_verification_required,
            'completionDetailsRecordedAt' => $this->completion_details_recorded_at?->toISOString(),
            'createdBy' => $this->whenLoaded('creator', fn () => $this->creator ? ['id' => (string) $this->creator->id, 'name' => $this->creator->name] : null),
            'startedBy' => $this->whenLoaded('starter', fn () => $this->starter ? ['id' => (string) $this->starter->id, 'name' => $this->starter->name] : null),
            'completedBy' => $this->whenLoaded('completer', fn () => $this->completer ? ['id' => (string) $this->completer->id, 'name' => $this->completer->name] : null),
            'cancelledBy' => $this->whenLoaded('canceller', fn () => $this->canceller ? ['id' => (string) $this->canceller->id, 'name' => $this->canceller->name] : null),
            'resultingConditionInspectionId' => $this->resulting_condition_inspection_id ? (string) $this->resulting_condition_inspection_id : null,
            'resultingCondition' => $this->whenLoaded('resultingConditionInspection', fn () => $this->resultingConditionInspection
                ? new VehicleInspectionResource($this->resultingConditionInspection)
                : null),
            'createdAt' => $this->created_at?->toISOString(),
        ];
    }
}
