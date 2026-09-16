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
            'speed' => $this->speed !== null ? (float) $this->speed : null,
            'accelerometerX' => $this->accelerometer_x !== null ? (float) $this->accelerometer_x : null,
            'accelerometerY' => $this->accelerometer_y !== null ? (float) $this->accelerometer_y : null,
            'accelerometerZ' => $this->accelerometer_z !== null ? (float) $this->accelerometer_z : null,
            'gyroscopeX' => $this->gyroscope_x !== null ? (float) $this->gyroscope_x : null,
            'gyroscopeY' => $this->gyroscope_y !== null ? (float) $this->gyroscope_y : null,
            'gyroscopeZ' => $this->gyroscope_z !== null ? (float) $this->gyroscope_z : null,
            'description' => $this->description,
            'occurredAt' => $this->occurred_at?->toISOString(),
            'time' => $this->occurred_at?->format('g:i A'),
            'location' => $this->latitude && $this->longitude ? $this->latitude.', '.$this->longitude : null,
        ];
    }
}
