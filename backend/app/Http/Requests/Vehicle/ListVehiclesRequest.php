<?php

namespace App\Http\Requests\Vehicle;

use App\Enums\VehicleStatus;
use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class ListVehiclesRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'nullable', 'string', 'max:160'],
            'status' => ['sometimes', 'string', Rule::enum(VehicleStatus::class)],
            'brand' => ['sometimes', 'nullable', 'string', 'max:80'],
            'transmission' => ['sometimes', 'nullable', 'string', 'max:40'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}
