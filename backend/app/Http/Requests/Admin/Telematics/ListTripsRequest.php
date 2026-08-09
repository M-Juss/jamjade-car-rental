<?php

namespace App\Http\Requests\Admin\Telematics;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class ListTripsRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('view fleet tracker') ?? false;
    }

    public function rules(): array
    {
        return [
            'status' => ['sometimes', 'string', Rule::in(['started', 'paused', 'ended'])],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}
