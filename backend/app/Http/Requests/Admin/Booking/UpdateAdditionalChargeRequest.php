<?php

namespace App\Http\Requests\Admin\Booking;

class UpdateAdditionalChargeRequest extends StoreAdditionalChargesRequest
{
    public function rules(): array
    {
        return [...parent::rules(), 'charges' => ['required', 'array', 'size:1']];
    }
}
