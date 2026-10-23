<?php

namespace App\Http\Requests\Admin\Booking;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Http\Requests\BaseFormRequest;
use App\Services\BookingAttentionService;
use Illuminate\Validation\Rule;

class ListBookingsRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manage bookings') ?? false;
    }

    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'nullable', 'string', 'max:160'],
            'status' => ['sometimes', 'string', Rule::enum(BookingStatus::class)],
            'attention' => ['sometimes', 'string', Rule::in([...array_keys(BookingAttentionService::LABELS), 'all_attention'])],
            'group' => ['sometimes', 'string', Rule::in(['booking', 'history'])],
            'payment_status' => ['sometimes', 'string', Rule::enum(PaymentStatus::class)],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}
