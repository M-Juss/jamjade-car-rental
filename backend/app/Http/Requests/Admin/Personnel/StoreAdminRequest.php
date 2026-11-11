<?php

namespace App\Http\Requests\Admin\Personnel;

use Illuminate\Validation\Rule;

class StoreAdminRequest extends StorePersonnelRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('owner');
    }

    public function rules(): array
    {
        return [...parent::rules(), 'role' => ['required', 'string', Rule::in(['admin']), Rule::exists('roles', 'name')->where('guard_name', 'web')]];
    }
}
