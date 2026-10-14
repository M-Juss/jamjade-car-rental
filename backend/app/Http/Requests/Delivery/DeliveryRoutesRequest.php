<?php

namespace App\Http\Requests\Delivery;

use App\Http\Requests\BaseFormRequest;

class DeliveryRoutesRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasRole('customer') ?? false;
    }

    public function rules(): array
    {
        return [
            'vehicle_id' => ['required', 'integer', 'exists:vehicles,id'], 'rental_start_at' => ['required', 'date', 'after:now'], 'rental_end_at' => ['required', 'date', 'after:rental_start_at'],
            'owner_driver_coverage' => ['required', 'in:metro_manila,outside_manila'], 'destination_address' => ['required', 'string', 'max:255'], 'destination_place_id' => ['nullable', 'string', 'max:255'],
            'latitude' => ['required', 'numeric', 'between:-90,90'], 'longitude' => ['required', 'numeric', 'between:-180,180'], 'point_confirmed' => ['required', 'accepted'],
        ];
    }
}
