<?php

namespace App\Http\Requests\Admin\Booking;

use App\Http\Requests\BaseFormRequest;
use App\Support\ValidationPatterns;

class ReviewCancellationRefundRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return ($this->user()?->hasRole('admin') ?? false) && ($this->user()?->can('manage bookings') ?? false);
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('reason'))) {
            $this->merge(['reason' => trim($this->input('reason'))]);
        }
    }

    public function rules(): array
    {
        return ['amount' => ['required', 'numeric', 'regex:'.ValidationPatterns::DECIMAL_2, 'decimal:0,2', 'min:0', 'max:9999999.99'], 'reason' => ['required', 'string', 'max:1000']];
    }
}
