<?php

namespace App\Http\Requests\OwnerAccount;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class RequestEmailChange extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('owner');
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['email' => strtolower(trim((string) $this->input('email')))]);
    }

    public function rules(): array
    {
        return ['email' => ['required', 'email:rfc', 'max:255', Rule::unique('users', 'email')], 'current_password' => ['required', 'string', 'current_password:web']];
    }
}
