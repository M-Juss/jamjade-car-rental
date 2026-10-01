<?php

namespace App\Http\Requests\Telematics;

use App\Http\Requests\BaseFormRequest;
use App\Models\Geofence;
use Illuminate\Validation\Rule;

class UpdateGeofenceRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasRole('admin') || ($this->user()?->can('manage geofences') ?? false);
    }

    public function rules(): array
    {
        /** @var Geofence $geofence */
        $geofence = $this->route('geofence');

        return [
            'name' => ['required', 'string', 'max:255', Rule::unique('geofences', 'name')->ignore($geofence)->whereNull('deleted_at')],
            'geometry_type' => ['required', 'in:circle,polygon'],
            'center_latitude' => ['required_if:geometry_type,circle', 'nullable', 'numeric', 'between:-90,90'],
            'center_longitude' => ['required_if:geometry_type,circle', 'nullable', 'numeric', 'between:-180,180'],
            'radius_meters' => ['required_if:geometry_type,circle', 'nullable', 'numeric', 'gt:0', 'max:100000'],
            'polygon_coordinates' => ['required_if:geometry_type,polygon', 'nullable', 'array', 'min:3', 'max:100'],
            'polygon_coordinates.*.latitude' => ['required_with:polygon_coordinates', 'numeric', 'between:-90,90'],
            'polygon_coordinates.*.longitude' => ['required_with:polygon_coordinates', 'numeric', 'between:-180,180'],
        ];
    }
}
