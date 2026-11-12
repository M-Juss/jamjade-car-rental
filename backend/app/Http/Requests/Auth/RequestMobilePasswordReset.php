<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\BaseFormRequest;

class RequestMobilePasswordReset extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['email' => ['required', 'string', 'email:rfc', 'max:255']];
    }

    protected function prepareForValidation(): void
    {
        $email = $this->input('email');
        $this->merge(['email' => is_string($email) ? strtolower(trim($email)) : $email]);
    }
}
