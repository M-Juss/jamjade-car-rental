<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VehicleInspectionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $items = $this->whenLoaded('items', fn () => $this->items
            ->groupBy(fn ($item) => $item->category->value)
            ->map(fn ($categoryItems) => $categoryItems->map(fn ($item) => [
                'key' => $item->item_key,
                'label' => $item->item_label,
                'value' => $item->value,
                'notes' => $item->notes,
            ])->values()), collect());

        return [
            'id' => (string) $this->id,
            'vehicleId' => (string) $this->vehicle_id,
            'booking' => $this->whenLoaded('booking', fn () => $this->booking ? [
                'id' => (string) $this->booking->id,
                'reference' => $this->booking->booking_code,
            ] : null),
            'type' => $this->type->value,
            'typeLabel' => $this->type->label(),
            'status' => $this->status->value,
            'odometer' => $this->odometer,
            'fuelLevel' => $this->fuel_level,
            'comments' => $this->comments,
            'conditionUpdateReason' => $this->condition_update_reason?->value,
            'conditionUpdateReasonLabel' => $this->condition_update_reason?->label(),
            'conditionUpdateNotes' => $this->condition_update_notes,
            'basedOnInspectionId' => $this->based_on_inspection_id ? (string) $this->based_on_inspection_id : null,
            'basedOnInspection' => $this->whenLoaded('basedOnInspection', fn () => $this->basedOnInspection ? [
                'id' => (string) $this->basedOnInspection->id,
                'type' => $this->basedOnInspection->type->value,
                'typeLabel' => $this->basedOnInspection->type->label(),
                'finalizedAt' => $this->basedOnInspection->finalized_at?->toISOString(),
            ] : null),
            'creator' => $this->whenLoaded('creator', fn () => $this->creator ? [
                'id' => (string) $this->creator->id,
                'name' => $this->creator->name,
            ] : null),
            'finalizedAt' => $this->finalized_at?->toISOString(),
            'createdAt' => $this->created_at?->toISOString(),
            'checklist' => $items,
            'markers' => $this->whenLoaded('markers', fn () => $this->markers->map(fn ($marker) => [
                'id' => (string) $marker->id,
                'sequenceNumber' => $marker->sequence_number,
                'panel' => $marker->panel->value,
                'xPosition' => (float) $marker->x_position,
                'yPosition' => (float) $marker->y_position,
                'issueType' => $marker->issue_type->value,
                'description' => $marker->description,
            ])->values(), []),
            'signatures' => $this->whenLoaded('signatures', fn () => $this->signatures->map(fn ($signature) => [
                'id' => (string) $signature->id,
                'signerType' => $signature->signer_type->value,
                'userId' => $signature->user_id ? (string) $signature->user_id : null,
                'signerName' => $signature->signer_name,
                'signedAt' => $signature->signed_at?->toISOString(),
            ])->values(), []),
        ];
    }
}
