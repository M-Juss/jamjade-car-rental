<?php

namespace App\Http\Requests\Research;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class StoreRcResearchSessionRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('admin');
    }

    public function rules(): array
    {
        $rules = [];
        foreach (['name', 'surface', 'app_version'] as $field) {
            $rules[$field] = ['required', 'string', 'max:100'];
        }

        return [...$rules,
            'phone_model' => ['sometimes', 'nullable', 'string', 'max:100'],
            'rc_model' => ['sometimes', 'nullable', 'string', 'max:100'],
            'mount_method' => ['sometimes', 'nullable', 'string', 'max:100'],
            'slope' => ['required', Rule::in(['level', 'uphill', 'downhill'])],
            'mount_orientation' => ['required', Rule::in(['flat', 'upright', 'tilted'])],
            'battery_condition' => ['required', Rule::in(['full', 'medium', 'low'])],
            'platform' => ['required', Rule::in(['android', 'ios'])],
            'rc_configuration' => ['nullable', 'string', 'max:500'],
            'consent' => ['required', 'boolean', 'accepted'],
            'added_load_g' => ['prohibited'], 'user_id' => ['prohibited'], 'protocol' => ['prohibited'],
        ];
    }
}
