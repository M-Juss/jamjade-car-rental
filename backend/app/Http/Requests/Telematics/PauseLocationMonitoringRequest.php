<?php

namespace App\Http\Requests\Telematics;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class PauseLocationMonitoringRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasAnyRole(['customer', 'driver']) ?? false;
    }

    public function rules(): array
    {
        return [
            'session_token' => ['required', 'string', 'size:64'],
            'reason' => ['sometimes', 'string', Rule::in(['manual', 'interrupted'])],
        ];
    }
}
