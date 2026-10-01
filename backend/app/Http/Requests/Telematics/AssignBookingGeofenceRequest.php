<?php

namespace App\Http\Requests\Telematics;

use App\Http\Requests\BaseFormRequest;

class AssignBookingGeofenceRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manage bookings') ?? false;
    }

    public function rules(): array
    {
        return [
            'source_geofence_id' => ['nullable', 'integer', 'exists:geofences,id'],
            'name' => ['required_without:source_geofence_id', 'nullable', 'string', 'max:255'],
            'geometry_type' => ['required_without:source_geofence_id', 'nullable', 'in:circle,polygon'],
            'center_latitude' => ['required_if:geometry_type,circle', 'required_without:source_geofence_id', 'nullable', 'numeric', 'between:-90,90'],
            'center_longitude' => ['required_if:geometry_type,circle', 'required_without:source_geofence_id', 'nullable', 'numeric', 'between:-180,180'],
            'radius_meters' => ['required_if:geometry_type,circle', 'required_without:source_geofence_id', 'nullable', 'numeric', 'gt:0', 'max:100000'],
            'polygon_coordinates' => ['required_if:geometry_type,polygon', 'required_without:source_geofence_id', 'nullable', 'array', 'min:3', 'max:100'],
            'polygon_coordinates.*.latitude' => ['required_with:polygon_coordinates', 'numeric', 'between:-90,90'],
            'polygon_coordinates.*.longitude' => ['required_with:polygon_coordinates', 'numeric', 'between:-180,180'],
        ];
    }
}
