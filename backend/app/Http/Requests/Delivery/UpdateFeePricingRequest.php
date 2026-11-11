<?php

namespace App\Http\Requests\Delivery;

use App\Http\Requests\Booking\UpdateLateReturnPricingRequest;

class UpdateFeePricingRequest extends UpdateDeliveryPricingRequest
{
    public function rules(): array
    {
        return array_intersect_key(parent::rules(), array_flip(['minimum_fee', 'included_km', 'per_km_rate']))
            + (new UpdateLateReturnPricingRequest)->rules();
    }
}
