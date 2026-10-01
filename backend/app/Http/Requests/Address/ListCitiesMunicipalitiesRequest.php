<?php

namespace App\Http\Requests\Address;

use App\Http\Requests\BaseFormRequest;

class ListCitiesMunicipalitiesRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'region_code' => ['nullable', 'string', 'max:20', 'regex:/^\d+$/'],
            'province_code' => ['nullable', 'required_without:region_code', 'string', 'max:20', 'regex:/^\d+$/'],
        ];
    }
}
