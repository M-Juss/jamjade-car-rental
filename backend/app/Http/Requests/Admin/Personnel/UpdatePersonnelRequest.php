<?php

namespace App\Http\Requests\Admin\Personnel;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class UpdatePersonnelRequest extends BaseFormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'first_name' => $this->normalizedName('first_name'),
            'last_name' => $this->normalizedName('last_name'),
            'email' => strtolower(trim((string) $this->input('email'))),
            'phone_number' => $this->filled('phone_number')
                ? trim((string) $this->input('phone_number'))
                : null,
        ]);
    }

    public function authorize(): bool
    {
        return $this->user()?->hasAnyRole(['admin', 'staff']) ?? false;
    }

    public function rules(): array
    {
        $userId = $this->route('user')?->id;

        return [
            'first_name' => ['required', 'string', 'max:80', 'regex:/^[\p{L} ]+$/u'],
            'last_name' => ['required', 'string', 'max:80', 'regex:/^[\p{L} ]+$/u'],
            'email' => ['required', 'email', 'max:160', Rule::unique('users', 'email')->ignore($userId)],
            'phone_number' => ['nullable', 'string', 'regex:/^09\d{9}$/', Rule::unique('users', 'phone_number')->ignore($userId)],
            'role' => ['required', 'string', Rule::in($this->user()->hasRole('owner') ? ['staff', 'driver', 'admin'] : ($this->user()->hasRole('admin') ? ['staff', 'driver'] : ['driver'])), Rule::exists('roles', 'name')->where('guard_name', 'web')],
            'is_active' => ['sometimes', 'boolean'],
            'modules' => ['prohibited'],
            'permissions' => ['prohibited'],
            'password' => [
                'nullable',
                'string',
                'min:8',
                'max:255',
                'regex:/[A-Z]/',
                'regex:/[!@#$%^&*()_+\-=\[\]{};\\\':"\\\\|,.<>\/?]/',
                'confirmed',
            ],
        ];
    }

    private function normalizedName(string $field): string
    {
        return preg_replace('/\s+/u', ' ', trim((string) $this->input($field))) ?? '';
    }
}
