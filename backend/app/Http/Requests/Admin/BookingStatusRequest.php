<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\BaseFormRequest;

class BookingStatusRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manage bookings') ?? false;
    }

    public function rules(): array
    {
        return [
            'reason' => [$this->routeIs('admin.bookings.cancel') ? 'required' : 'nullable', 'string', 'max:1000'],
            'admin_notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
