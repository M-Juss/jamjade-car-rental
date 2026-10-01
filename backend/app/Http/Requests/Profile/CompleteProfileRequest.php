<?php

namespace App\Http\Requests\Profile;

use App\Http\Requests\BaseFormRequest;
use App\Http\Requests\Concerns\ValidatesStructuredProfileAddress;
use App\Support\CustomerAgePolicy;

class CompleteProfileRequest extends BaseFormRequest
{
    use ValidatesStructuredProfileAddress;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'first_name' => ['sometimes', 'required', 'string', 'max:100', 'regex:/^[\pL ]+$/u'],
            'last_name' => ['sometimes', 'required', 'string', 'max:100', 'regex:/^[\pL ]+$/u'],
            'birthdate' => [
                'sometimes',
                'required',
                'date',
                'before_or_equal:'.CustomerAgePolicy::latestEligibleBirthdate(),
            ],
            'address' => ['sometimes', 'required', 'string', 'max:1000'],
            'country_code' => ['sometimes', 'required_with:region_code,city_municipality_code,barangay_code,address_line', 'string', 'size:2', 'in:PH'],
            'region_code' => ['sometimes', 'required_with:country_code,city_municipality_code,barangay_code,address_line', 'string', 'max:20', 'regex:/^\d+$/'],
            'province_code' => ['sometimes', 'nullable', 'string', 'max:20', 'regex:/^\d+$/'],
            'city_municipality_code' => ['sometimes', 'required_with:country_code,region_code,barangay_code,address_line', 'string', 'max:20', 'regex:/^\d+$/'],
            'barangay_code' => ['sometimes', 'required_with:country_code,region_code,city_municipality_code,address_line', 'string', 'max:20', 'regex:/^\d+$/'],
            'address_line' => ['sometimes', 'required_with:country_code,region_code,city_municipality_code,barangay_code', 'string', 'max:255'],
            'postal_code' => ['required_with:country_code,region_code,city_municipality_code,barangay_code,address_line', 'string', 'max:20'],
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
            'birthdate.before_or_equal' => CustomerAgePolicy::MESSAGE,
            'phone_number.size' => 'The contact number must contain 11 digits.',
            'phone_number.regex' => 'The contact number must start with 09 and contain 11 digits.',
        ];
    }
}
