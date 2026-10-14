<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TelematicsTripResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'bookingId' => $this->booking?->booking_code,
            'status' => $this->status,
            'tripStatus' => $this->status,
            'startedAt' => $this->started_at?->toISOString(),
            'pausedAt' => $this->paused_at?->toISOString(),
            'resumedAt' => $this->resumed_at?->toISOString(),
            'endedAt' => $this->ended_at?->toISOString(),
            'vehicleLocation' => [
                'label' => 'Vehicle',
                'latitude' => $this->current_latitude !== null ? (float) $this->current_latitude : null,
                'longitude' => $this->current_longitude !== null ? (float) $this->current_longitude : null,
            ],
            'speedKph' => $this->current_speed !== null ? (float) $this->current_speed : 0,
            'batteryPercent' => $this->battery_percent,
            'gpsSignalPercent' => $this->gps_signal_percent,
            'monitoringZones' => $this->whenLoaded('geofenceStates', fn () => $this->geofenceStates->map(fn ($state) => [
                'name' => $state->zone->name_snapshot,
                'state' => $state->uncertain ? 'uncertain' : ($state->inside === null ? 'unknown' : ($state->inside ? 'inside' : 'outside')),
                'checkedAt' => $state->last_captured_at?->toISOString(),
            ])),
            'lastLocationAt' => $this->last_location_at?->toISOString(),
            'booking' => new BookingResource($this->whenLoaded('booking')),
            'vehicle' => $this->booking?->relationLoaded('vehicle')
                ? new VehicleResource($this->booking->vehicle)
                : null,
            'events' => TelematicsEventResource::collection($this->whenLoaded('events')),
        ];
    }
}
