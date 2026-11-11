<?php

namespace App\Http\Requests\Telematics;

use App\Http\Requests\BaseFormRequest;

class RestartSetupRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasAnyRole(['customer', 'driver']);
    }

    public function rules(): array
    {
        return ['context' => ['required', 'string', 'regex:/^[a-f0-9]{64}$/']];
    }
}
