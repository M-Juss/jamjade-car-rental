<?php

namespace App\Http\Requests\Admin\Booking;

use App\Http\Requests\BaseFormRequest;

class RecordCancellationRefundRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return ($this->user()?->hasRole('admin') ?? false) && ($this->user()?->can('manage bookings') ?? false);
    }

    public function rules(): array
    {
        return ['confirmed' => ['required', 'accepted']];
    }
}
