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
                'area' => $this->current_zone,
                'latitude' => $this->current_latitude !== null ? (float) $this->current_latitude : null,
                'longitude' => $this->current_longitude !== null ? (float) $this->current_longitude : null,
            ],
            'speedKph' => $this->current_speed !== null ? (float) $this->current_speed : 0,
            'batteryPercent' => $this->battery_percent,
            'gpsSignalPercent' => $this->gps_signal_percent,
            'currentZone' => $this->current_zone,
            'allowedZone' => $this->allowed_zone,
            'lastLocationAt' => $this->last_location_at?->toISOString(),
            'booking' => new BookingResource($this->whenLoaded('booking')),
            'vehicle' => $this->booking?->relationLoaded('vehicle')
                ? new VehicleResource($this->booking->vehicle)
                : null,
            'events' => TelematicsEventResource::collection($this->whenLoaded('events')),
            'geofenceLogs' => $this->whenLoaded('events', fn () => $this->events
                ->whereNotNull('geofence_status')
                ->map(fn ($event) => [
                    'id' => $event->id,
                    'status' => $event->geofence_status,
                    'latitude' => $event->latitude !== null ? (float) $event->latitude : null,
                    'longitude' => $event->longitude !== null ? (float) $event->longitude : null,
                    'distanceFromAllowedArea' => $event->distance_from_allowed_area !== null
                        ? (float) $event->distance_from_allowed_area
                        : null,
                    'currentArea' => $event->current_area,
                    'allowedArea' => $this->allowed_zone,
                    'occurredAt' => $event->occurred_at?->toISOString(),
                ])->values()),
        ];
    }
}
