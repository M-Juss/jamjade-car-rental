<?php

namespace App\Http\Requests\Profile;

use App\Http\Requests\BaseFormRequest;

class CompleteProfileRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'first_name' => ['sometimes', 'required', 'string', 'max:100', 'regex:/^[\pL ]+$/u'],
            'last_name' => ['sometimes', 'required', 'string', 'max:100', 'regex:/^[\pL ]+$/u'],
            'birthdate' => ['sometimes', 'required', 'date', 'before_or_equal:today'],
            'address' => ['sometimes', 'required', 'string', 'max:1000'],
            'phone_number' => ['sometimes', 'required', 'string', 'size:11', 'regex:/^09\d{9}$/', 'unique:users,phone_number,'.$this->user()->id],
            'profile_picture' => ['nullable', 'image', 'max:5120'],
            'wants_self_drive' => ['nullable', 'boolean'],
            'driving_intent' => ['nullable', 'in:self_drive,owner_driver,not_sure'],
        ];
    }

    protected function prepareForValidation(): void
    {
        foreach (['first_name', 'last_name'] as $field) {
            if ($this->filled($field)) {
                $this->merge([
                    $field => trim(preg_replace('/\s+/', ' ', (string) $this->input($field))),
                ]);
            }
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
            'first_name.regex' => 'The first name may only contain letters and spaces.',
            'last_name.regex' => 'The last name may only contain letters and spaces.',
            'phone_number.size' => 'The contact number must contain 11 digits.',
            'phone_number.regex' => 'The contact number must start with 09 and contain 11 digits.',
        ];
    }
}
