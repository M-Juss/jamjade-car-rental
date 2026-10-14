<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\BaseFormRequest;
use Closure;
use Illuminate\Validation\Rules\Password;

class ChangeAccountPasswordRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'current_password' => ['required', 'string'],
            'password' => [
                'required', 'string', 'confirmed', 'different:current_password', Password::min(8), 'max:72',
                function (string $attribute, mixed $value, Closure $fail): void {
                    // Bcrypt must not silently truncate a longer UTF-8 password.
                    if (is_string($value) && strlen($value) > 72) {
                        $fail('The new password must be 72 UTF-8 bytes or fewer.');
                    }
                },
            ],
            'password_confirmation' => ['required', 'string'],
        ];
    }
}
