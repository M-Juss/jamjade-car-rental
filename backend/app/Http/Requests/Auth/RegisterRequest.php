<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\BaseFormRequest;
use App\Support\AccountPasswordRules;

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
            'password' => [...AccountPasswordRules::required(), 'confirmed'],
            'device_name' => ['nullable', 'string', 'max:120'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $email = $this->input('email');
        $phoneNumber = $this->input('phone_number');

        $this->merge([
            'email' => is_string($email) ? strtolower(trim($email)) : $email,
            'phone_number' => is_string($phoneNumber)
                ? (trim($phoneNumber) === '' ? null : preg_replace('/\D+/', '', $phoneNumber))
                : $phoneNumber,
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
