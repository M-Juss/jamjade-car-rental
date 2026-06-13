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
            'vehicle' => new VehicleResource($this->whenLoaded('vehicle')),
            'events' => TelematicsEventResource::collection($this->whenLoaded('events')),
            'geofenceLogs' => $this->whenLoaded('geofenceLogs', fn () => $this->geofenceLogs->map(fn ($log) => [
                'id' => $log->id,
                'status' => $log->status,
                'latitude' => $log->latitude !== null ? (float) $log->latitude : null,
                'longitude' => $log->longitude !== null ? (float) $log->longitude : null,
                'distanceFromAllowedArea' => $log->distance_from_allowed_area !== null ? (float) $log->distance_from_allowed_area : null,
                'currentArea' => $log->current_area,
                'allowedArea' => $log->allowed_area,
                'occurredAt' => $log->occurred_at?->toISOString(),
            ])->values()),
        ];
    }
}
