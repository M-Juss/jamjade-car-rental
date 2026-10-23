<?php

namespace App\Http\Requests\Admin\Booking;

use App\Http\Requests\BaseFormRequest;

class ReturnFollowUpRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manage bookings') ?? false;
    }

    public function rules(): array
    {
        return [
            'note' => ['required', 'string', 'max:1000'],
            'expected_return_at' => ['nullable', 'date', 'after:now'],
        ];
    }
}
