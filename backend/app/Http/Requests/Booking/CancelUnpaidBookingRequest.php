<?php

namespace App\Http\Requests\Booking;

use App\Http\Requests\BaseFormRequest;

class CancelUnpaidBookingRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasRole('customer') ?? false;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('reason'))) {
            $this->merge(['reason' => trim($this->input('reason'))]);
        }
    }

    public function rules(): array
    {
        return ['reason' => ['required', 'string', 'max:1000']];
    }
}
