<?php

namespace App\Http\Requests\Telematics;

use App\Http\Requests\BaseFormRequest;

class StoreLocationRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy' => ['nullable', 'numeric', 'min:0', 'max:10000'],
            'speed' => ['nullable', 'numeric', 'min:0', 'max:300'],
            'heading' => ['nullable', 'numeric', 'between:0,360'],
            'battery_percent' => ['nullable', 'integer', 'between:0,100'],
            'gps_signal_percent' => ['nullable', 'integer', 'between:0,100'],
            'current_zone' => ['prohibited'],
            'captured_at' => ['required', 'date', 'before_or_equal:'.now()->addSeconds(config('telematics.setup_gps_future_skew_seconds'))->toISOString()],
        ];
    }
}
