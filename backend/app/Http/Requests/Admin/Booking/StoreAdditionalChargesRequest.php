<?php

namespace App\Http\Requests\Admin\Booking;

use App\Enums\AdditionalChargeResponsibility;
use App\Enums\AdditionalChargeType;
use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class StoreAdditionalChargesRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manage bookings') ?? false;
    }

    public function rules(): array
    {
        return [
            'charges' => ['required', 'array', 'min:1', 'max:20'],
            'charges.*.type' => ['required', Rule::enum(AdditionalChargeType::class), Rule::notIn(['late_return'])],
            'charges.*.description' => ['required', 'string', 'max:1000'],
            'charges.*.amount' => ['required', 'numeric', 'decimal:0,2', 'gt:0', 'max:9999999.99'],
            'charges.*.responsibility' => ['nullable', Rule::enum(AdditionalChargeResponsibility::class)],
        ];
    }
}
