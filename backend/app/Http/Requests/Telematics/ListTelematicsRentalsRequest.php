<?php

namespace App\Http\Requests\Telematics;

use App\Http\Requests\BaseFormRequest;

class ListTelematicsRentalsRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('customer');
    }

    public function rules(): array
    {
        return [
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:30'],
        ];
    }
}
