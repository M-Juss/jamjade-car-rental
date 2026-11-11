<?php

namespace App\Http\Requests\Payment;

use App\Support\BookingAgreement;
use Illuminate\Validation\Rule;

class RevisePayPalOrderRequest extends CreatePayPalOrderRequest
{
    public function rules(): array
    {
        return array_merge(parent::rules(), [
            'terms_version' => ['required', Rule::in([BookingAgreement::VERSION])],
            'reviewed_pricing' => ['required', 'array:price_per_day,subtotal,delivery_fee,delivery_toll_fee,owner_driver_fee,total_amount'],
        ]);
    }
}
