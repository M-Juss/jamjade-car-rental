<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'email:rfc', 'max:255', 'unique:users,email'],
            'phone_number' => ['nullable', 'string', 'size:11', 'regex:/^09\d{9}$/', 'unique:users,phone_number'],
            'password' => ['required', 'confirmed', Password::min(8)],
            'device_name' => ['nullable', 'string', 'max:120'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'email' => strtolower(trim((string) $this->input('email'))),
            'phone_number' => $this->filled('phone_number')
                ? preg_replace('/\D+/', '', (string) $this->input('phone_number'))
                : null,
        ]);
    }

    public function messages(): array
    {
        return [
            'phone_number.size' => 'The contact number must contain 11 digits.',
            'phone_number.regex' => 'The contact number must start with 09 and contain 11 digits.',
        ];
    }
}
