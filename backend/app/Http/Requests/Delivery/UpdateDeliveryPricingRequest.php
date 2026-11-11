<?php

namespace App\Http\Requests\Delivery;

use App\Http\Requests\BaseFormRequest;
use App\Support\ValidationPatterns;

class UpdateDeliveryPricingRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasRole('admin') ?? false;
    }

    public function rules(): array
    {
        return [
            'minimum_fee' => ['required', 'numeric', 'regex:'.ValidationPatterns::DECIMAL_2, 'decimal:0,2', 'between:0,1000000'],
            'included_km' => ['required', 'numeric', 'regex:'.ValidationPatterns::DECIMAL_3, 'decimal:0,3', 'between:0,1000000'],
            'per_km_rate' => ['required', 'numeric', 'regex:'.ValidationPatterns::DECIMAL_2, 'decimal:0,2', 'between:0,1000000'],
            'garage_address' => ['sometimes', 'required', 'string', 'max:255'],
            'garage_latitude' => ['sometimes', 'required', 'numeric', 'regex:'.ValidationPatterns::SIGNED_DECIMAL, 'between:-90,90'],
            'garage_longitude' => ['sometimes', 'required', 'numeric', 'regex:'.ValidationPatterns::SIGNED_DECIMAL, 'between:-180,180'],
        ];
    }
}
