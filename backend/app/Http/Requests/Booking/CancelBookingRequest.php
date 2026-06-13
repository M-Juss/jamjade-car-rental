<?php

namespace App\Http\Requests\Booking;

use App\Http\Requests\BaseFormRequest;

class CancelBookingRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'reason' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
