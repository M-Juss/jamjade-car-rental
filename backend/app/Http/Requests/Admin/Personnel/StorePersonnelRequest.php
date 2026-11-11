<?php

namespace App\Http\Requests\Admin\Personnel;

use App\Http\Requests\BaseFormRequest;
use App\Support\AccountPasswordRules;
use App\Support\ValidationPatterns;
use Illuminate\Validation\Rule;

class StorePersonnelRequest extends BaseFormRequest
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
        return [
            'first_name' => ['required', 'string', 'max:80', 'regex:'.ValidationPatterns::PERSON_NAME],
            'last_name' => ['required', 'string', 'max:80', 'regex:'.ValidationPatterns::PERSON_NAME],
            'email' => ['required', 'email', 'max:160', 'unique:users,email'],
            'phone_number' => ['nullable', 'string', 'regex:/^09\d{9}$/', 'unique:users,phone_number'],
            'role' => ['required', 'string', Rule::in($this->user()->hasRole('owner') ? ['staff', 'driver', 'admin'] : ($this->user()->hasRole('admin') ? ['staff', 'driver'] : ['driver'])), Rule::exists('roles', 'name')->where('guard_name', 'web')],
            'is_active' => ['sometimes', 'boolean'],
            'modules' => ['prohibited'],
            'permissions' => ['prohibited'],
            'password' => [...AccountPasswordRules::required(), 'confirmed'],
        ];
    }

    private function normalizedName(string $field): string
    {
        return preg_replace('/\s+/u', ' ', trim((string) $this->input($field))) ?? '';
    }
}
