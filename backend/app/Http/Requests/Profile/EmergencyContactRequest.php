<?php

namespace App\Http\Requests\Profile;

use App\Http\Requests\BaseFormRequest;
use App\Support\ValidationPatterns;

class EmergencyContactRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100', 'regex:'.ValidationPatterns::PERSON_NAME],
            'relationship' => ['required', 'string', 'max:80'],
            'phone_number' => ['required', 'string', 'size:11', 'regex:/^09\d{9}$/'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('name')) {
            $this->merge([
                'name' => trim(preg_replace('/\s+/', ' ', (string) $this->input('name'))),
            ]);
        }

        if ($this->filled('phone_number')) {
            $this->merge([
                'phone_number' => preg_replace('/\D+/', '', (string) $this->input('phone_number')),
            ]);
        }
    }

    public function messages(): array
    {
        return [
            'name.regex' => 'The emergency contact name may contain letters, spaces, apostrophes, or hyphens, but no numbers.',
            'phone_number.size' => 'The emergency contact number must contain 11 digits.',
            'phone_number.regex' => 'The emergency contact number must start with 09 and contain 11 digits.',
        ];
    }
}
