<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\BaseFormRequest;

class BookingStatusRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manage bookings') ?? false;
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
            'reason' => [$this->routeIs('admin.bookings.cancel', 'admin.bookings.reject') ? 'required' : 'nullable', 'string', 'max:1000'],
            'admin_notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
