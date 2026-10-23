<?php

namespace App\Http\Requests\Booking;

use App\Http\Requests\BaseFormRequest;

class UpdateLateReturnPricingRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasRole('admin') ?? false;
    }

    public function rules(): array
    {
        return [
            'small_vehicle_hourly_rate' => ['required', 'numeric', 'decimal:0,2', 'between:0.01,1000000'],
            'large_vehicle_hourly_rate' => ['required', 'numeric', 'decimal:0,2', 'between:0.01,1000000'],
        ];
    }
}
