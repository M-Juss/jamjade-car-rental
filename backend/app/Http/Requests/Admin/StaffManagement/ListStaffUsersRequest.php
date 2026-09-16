<?php

namespace App\Http\Requests\Admin\StaffManagement;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class ListStaffUsersRequest extends BaseFormRequest
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
            'role' => ['sometimes', 'string', 'max:80'],
        ];
    }
}
