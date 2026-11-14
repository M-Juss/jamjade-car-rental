<?php

namespace App\Http\Requests\Admin\Booking;

use App\Http\Requests\Admin\BookingStatusRequest;
use App\Support\ValidationPatterns;
use Illuminate\Validation\Rule;

class CancelBookingRequest extends BookingStatusRequest
{
    public function authorize(): bool
    {
        return parent::authorize() && (! $this->has('refund_mode') || ($this->user()?->hasRole('admin') ?? false));
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('reason'))) {
            $this->merge(['reason' => trim($this->input('reason'))]);
        }
    }

    public function rules(): array
    {
        return [
            ...parent::rules(),
            'refund_mode' => ['sometimes', 'required', Rule::in(['full', 'custom'])],
            'refund_amount' => ['prohibited_unless:refund_mode,custom', 'required_if:refund_mode,custom', 'numeric', 'regex:'.ValidationPatterns::DECIMAL_2, 'decimal:0,2', 'gt:0', 'max:9999999.99'],
        ];
    }
}
