<?php

namespace App\Http\Requests\Admin\Personnel;

use App\Http\Requests\BaseFormRequest;
use App\Support\AccountPasswordRules;
use App\Support\ValidationPatterns;
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
        return $this->user()?->hasRole('owner') ?? false;
    }

    public function rules(): array
    {
        $userId = $this->route('user')?->id;

        return [
            'first_name' => ['required', 'string', 'max:80', 'regex:'.ValidationPatterns::PERSON_NAME],
            'last_name' => ['required', 'string', 'max:80', 'regex:'.ValidationPatterns::PERSON_NAME],
            'email' => ['required', 'email', 'max:160', Rule::unique('users', 'email')->ignore($userId)],
            'phone_number' => [Rule::requiredIf(in_array($this->input('role'), ['staff', 'driver'], true)), 'nullable', 'string', 'regex:/^09\d{9}$/', Rule::unique('users', 'phone_number')->ignore($userId)],
            'role' => ['required', 'string', Rule::in(['staff', 'driver', 'admin']), Rule::exists('roles', 'name')->where('guard_name', 'web')],
            'is_active' => ['sometimes', 'boolean'],
            'modules' => ['prohibited'],
            'permissions' => ['prohibited'],
            'password' => [...AccountPasswordRules::optional(), 'confirmed'],
        ];
    }

    private function normalizedName(string $field): string
    {
        return preg_replace('/\s+/u', ' ', trim((string) $this->input($field))) ?? '';
    }
}
