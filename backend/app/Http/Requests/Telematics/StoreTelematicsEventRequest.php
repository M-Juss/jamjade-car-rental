<?php

namespace App\Http\Requests\Telematics;

use App\Enums\TelematicsEventType;
use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class StoreTelematicsEventRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'event_type' => ['required', Rule::enum(TelematicsEventType::class)],
            'severity' => ['nullable', 'in:low,medium,high'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'metadata' => ['nullable', 'array'],
            'occurred_at' => ['nullable', 'date'],
        ];
    }
}
