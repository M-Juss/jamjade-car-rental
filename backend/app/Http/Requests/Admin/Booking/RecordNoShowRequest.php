<?php

namespace App\Http\Requests\Admin\Booking;

use App\Http\Requests\BaseFormRequest;

class RecordNoShowRequest extends BaseFormRequest
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
        return ['reason' => ['required', 'string', 'max:1000'], 'confirmed' => ['required', 'accepted']];
    }
}
