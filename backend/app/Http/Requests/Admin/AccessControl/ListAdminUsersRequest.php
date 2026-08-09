<?php

namespace App\Http\Requests\Admin\AccessControl;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class ListAdminUsersRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('owner');
    }

    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'nullable', 'string', 'max:160'],
            'status' => ['sometimes', 'string', Rule::in(['all', 'active', 'inactive'])],
            'role' => ['sometimes', 'string', 'max:80'],
        ];
    }
}
