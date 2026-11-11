<?php

namespace App\Http\Requests\Admin\Booking;

use App\Http\Requests\BaseFormRequest;

class ListDrivingAnalysisRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return ($this->user()?->can('manage bookings') ?? false)
            && ($this->user()?->can('view fleet tracker') ?? false);
    }

    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'nullable', 'string', 'max:160'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'operator_id' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
            'vehicle_id' => ['sometimes', 'nullable', 'integer', 'exists:vehicles,id'],
        ];
    }
}
