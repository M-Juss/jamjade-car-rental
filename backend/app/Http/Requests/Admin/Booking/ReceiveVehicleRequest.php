<?php

namespace App\Http\Requests\Admin\Booking;

use App\Http\Requests\BaseFormRequest;

class ReceiveVehicleRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manage bookings') ?? false;
    }

    public function rules(): array
    {
        return ['vehicle_received_at' => ['required', 'date', 'before_or_equal:now']];
    }
}
