<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\BaseFormRequest;

class LoginRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'login' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone_number' => ['nullable', 'string', 'max:30'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:120'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if (! $this->filled('login') && ! $this->filled('email') && ! $this->filled('phone_number')) {
                $validator->errors()->add('login', 'Email, phone number, or login is required.');
            }
        });
    }

    protected function prepareForValidation(): void
    {
        $email = $this->input('email');
        $phoneNumber = $this->input('phone_number');
        $login = $this->input('login');
        $login = is_string($login) ? trim($login) : $login;

        $this->merge([
            'email' => is_string($email) ? strtolower(trim($email)) : $email,
            'phone_number' => is_string($phoneNumber)
                ? preg_replace('/[\s()-]+/', '', $phoneNumber)
                : $phoneNumber,
            'login' => $login === ''
                ? null
                : (is_string($login) && str_contains($login, '@') ? strtolower($login) : $login),
        ]);
    }
}
