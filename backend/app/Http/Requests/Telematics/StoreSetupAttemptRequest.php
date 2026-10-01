<?php

namespace App\Http\Requests\Telematics;

use App\Http\Requests\BaseFormRequest;

class StoreSetupAttemptRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['prohibited'],
            'evidence' => ['required', 'array'],
            'evidence.status' => ['prohibited'],
        ];
    }
}
