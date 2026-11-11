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
            'password' => [
                'required', 'string', 'confirmed', Password::min(8), 'max:72',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (is_string($value) && strlen($value) > 72) {
                        $fail('The password must be 72 UTF-8 bytes or fewer.');
                    }
                },
            ],
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
