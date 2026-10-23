<?php

namespace App\Http\Requests\Telematics;

use App\Http\Requests\BaseFormRequest;

class LatestLocationRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasAnyRole(['customer', 'driver']) ?? false;
    }

    public function rules(): array
    {
        return [
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy' => ['required', 'numeric', 'min:0', 'max:'.config('telematics.foreground_location.maximum_accuracy_meters')],
            'captured_at' => ['required', 'date'],
            'session_token' => ['required', 'string', 'size:64'],
            'speed' => ['prohibited'], 'heading' => ['prohibited'],
            'current_zone' => ['prohibited'], 'samples' => ['prohibited'],
        ];
    }
}
