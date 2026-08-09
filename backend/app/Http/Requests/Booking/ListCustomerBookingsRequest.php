<?php

namespace App\Http\Requests\Booking;

use App\Enums\BookingStatus;
use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class ListCustomerBookingsRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('customer');
    }

    public function rules(): array
    {
        return [
            'status' => ['sometimes', 'string', Rule::enum(BookingStatus::class)],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}
