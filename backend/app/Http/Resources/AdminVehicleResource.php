<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

class AdminVehicleResource extends VehicleResource
{
    public function toArray(Request $request): array
    {
        $hasOngoingRental = $this->relationLoaded('ongoingBookings')
            ? $this->ongoingBookings->isNotEmpty()
            : null;

        return [
            ...parent::toArray($request),
            'hasCurrentCondition' => $this->current_condition_inspection_id !== null,
            'currentCondition' => $this->whenLoaded(
                'currentCondition',
                fn () => $this->currentCondition ? new VehicleInspectionResource($this->currentCondition) : null
            ),
            'hasOngoingRental' => $this->when($hasOngoingRental !== null, $hasOngoingRental),
            'canUpdateCurrentCondition' => $this->when(
                $hasOngoingRental !== null,
                $this->current_condition_inspection_id !== null && ! $hasOngoingRental
            ),
            'conditionUpdateBlockedReason' => $this->when(
                $hasOngoingRental === true,
                'Current condition cannot be updated while this vehicle has an ongoing rental.'
            ),
        ];
    }
}
