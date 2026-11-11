<?php

namespace App\Http\Requests\Admin\Invitation;

use App\Http\Requests\BaseFormRequest;

class InviteAdminRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasRole('owner') ?? false;
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['email' => strtolower(trim((string) $this->input('email')))]);
    }

    public function rules(): array
    {
        return ['email' => ['required', 'email', 'max:160', 'unique:users,email']];
    }
}
