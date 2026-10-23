<?php

namespace App\Http\Requests\Delivery;

use App\Http\Requests\BaseFormRequest;

class UpdateDeliveryPricingRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasRole('admin') ?? false;
    }

    public function rules(): array
    {
        return [
            'minimum_fee' => ['required', 'numeric', 'decimal:0,2', 'between:0,1000000'],
            'included_km' => ['required', 'numeric', 'decimal:0,3', 'between:0,1000000'],
            'per_km_rate' => ['required', 'numeric', 'decimal:0,2', 'between:0,1000000'],
            'garage_address' => ['sometimes', 'required', 'string', 'max:255'],
            'garage_latitude' => ['sometimes', 'required', 'numeric', 'between:-90,90'],
            'garage_longitude' => ['sometimes', 'required', 'numeric', 'between:-180,180'],
        ];
    }
}
