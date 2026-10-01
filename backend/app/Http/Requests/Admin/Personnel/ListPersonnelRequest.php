<?php

namespace App\Http\Requests\Admin\Personnel;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class ListPersonnelRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('admin');
    }

    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'nullable', 'string', 'max:160'],
            'status' => ['sometimes', 'string', Rule::in(['all', 'active', 'inactive'])],
            'role' => ['sometimes', 'string', Rule::in(['all', 'staff', 'driver'])],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}
