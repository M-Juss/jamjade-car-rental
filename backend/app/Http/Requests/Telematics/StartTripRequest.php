<?php

namespace App\Http\Requests\Telematics;

use App\Http\Requests\BaseFormRequest;

class StartTripRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'booking_id' => ['required', 'exists:bookings,id'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'battery_percent' => ['nullable', 'integer', 'between:0,100'],
            'gps_signal_percent' => ['nullable', 'integer', 'between:0,100'],
            'current_zone' => ['nullable', 'string', 'max:120'],
        ];
    }
}
