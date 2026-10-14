<?php

namespace App\Http\Requests\Telematics;

class SaveBookingGeofenceRequest extends StoreGeofenceRequest
{
    public function rules(): array
    {
        return [...parent::rules(), 'name' => ['required', 'string', 'max:255']];
    }
}
