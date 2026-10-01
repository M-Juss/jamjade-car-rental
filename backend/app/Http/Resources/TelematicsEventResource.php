<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TelematicsEventResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'tripId' => $this->trip_id,
            'bookingId' => $this->trip?->booking?->booking_code,
            'eventType' => $this->event_type->value,
            'type' => $this->event_type->label(),
            'severity' => str($this->severity)->title()->toString(),
            'latitude' => $this->latitude !== null ? (float) $this->latitude : null,
            'longitude' => $this->longitude !== null ? (float) $this->longitude : null,
            'metadata' => $this->metadata,
            'occurredAt' => $this->occurred_at?->toISOString(),
            'time' => $this->occurred_at?->format('g:i A'),
            'location' => $this->latitude !== null && $this->longitude !== null ? $this->latitude.', '.$this->longitude : null,
        ];
    }
}
