<?php

namespace App\Http\Requests\Admin\Customer;

use App\Http\Requests\BaseFormRequest;

class ListCustomersRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manage customers') ?? false;
    }

    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'nullable', 'string', 'max:160'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}
