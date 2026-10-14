<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BookingGeofenceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id ? (string) $this->id : null,
            'name' => $this->name_snapshot,
            'scope' => $this->scope,
            'geometryType' => $this->geometry_type,
            'centerLatitude' => $this->center_latitude === null ? null : (float) $this->center_latitude,
            'centerLongitude' => $this->center_longitude === null ? null : (float) $this->center_longitude,
            'radiusMeters' => $this->radius_meters === null ? null : (float) $this->radius_meters,
            'polygonCoordinates' => $this->polygon_coordinates,
            'notifyOnEnter' => $this->notify_on_enter,
            'notifyOnExit' => $this->notify_on_exit,
            'frozenAt' => $this->frozen_at?->toISOString(),
        ];
    }
}
