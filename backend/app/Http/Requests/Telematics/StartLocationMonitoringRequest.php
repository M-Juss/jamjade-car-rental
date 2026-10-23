<?php

namespace App\Http\Requests\Telematics;

use Illuminate\Validation\Rule;

class StartLocationMonitoringRequest extends LatestLocationRequest
{
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'session_token' => ['prohibited'],
            'consent' => ['required', 'boolean', 'accepted'],
            'consent_version' => ['required', 'integer', Rule::in([config('telematics.foreground_location.consent_version')])],
            'sharing_mode' => ['required', Rule::in(['foreground', 'foreground_background'])],
        ];
    }
}
