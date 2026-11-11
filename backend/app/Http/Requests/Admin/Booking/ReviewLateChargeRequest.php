<?php

namespace App\Http\Requests\Admin\Booking;

use App\Http\Requests\BaseFormRequest;
use App\Support\ValidationPatterns;
use Illuminate\Validation\Rule;

class ReviewLateChargeRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manage bookings') ?? false;
    }

    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'regex:'.ValidationPatterns::DECIMAL_2, 'decimal:0,2', 'between:0,9999999.99'],
            'adjustment_reason' => ['nullable', 'string', 'max:1000'],
            'responsibility' => ['required', Rule::in(['customer', 'driver'])],
        ];
    }
}
