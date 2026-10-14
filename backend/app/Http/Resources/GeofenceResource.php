<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GeofenceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'geometryType' => $this->geometry_type,
            'centerLatitude' => $this->center_latitude === null ? null : (float) $this->center_latitude,
            'centerLongitude' => $this->center_longitude === null ? null : (float) $this->center_longitude,
            'radiusMeters' => $this->radius_meters === null ? null : (float) $this->radius_meters,
            'polygonCoordinates' => $this->polygon_coordinates,
            'notifyOnEnter' => $this->notify_on_enter,
            'notifyOnExit' => $this->notify_on_exit,
            'isActive' => $this->is_active,
            'isDeleted' => $this->deleted_at !== null,
            'deletedAt' => $this->deleted_at?->toISOString(),
            'rentalSnapshotCount' => $this->whenCounted('bookingSnapshots'),
            'createdBy' => $this->whenLoaded('creator', fn () => $this->creator ? [
                'id' => (string) $this->creator->id,
                'name' => $this->creator->name,
            ] : null),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
