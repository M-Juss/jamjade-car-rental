<?php

namespace App\Http\Requests\Booking;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class StoreBookingRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $driverOption = $this->input('driver_option');
        $pickupLocationType = $driverOption === 'self_drive' ? 'shop' : 'delivery';

        return [
            'vehicle_id' => ['required', 'exists:vehicles,id'],
            'rental_start_at' => ['required', 'date', 'after_or_equal:today'],
            'rental_end_at' => ['required', 'date', 'after:rental_start_at'],
            'pickup_location_type' => ['required', Rule::in([$pickupLocationType])],
            'pickup_location' => ['required', 'string', 'max:255'],
            'return_location' => ['required', 'string', 'max:255'],
            'driver_option' => ['required', 'in:self_drive,owners_driver'],
            'owner_driver_coverage' => ['nullable', 'required_if:driver_option,owners_driver', 'in:metro_manila,outside_manila'],
            'add_ons_total' => ['nullable', 'numeric', 'min:0'],
            'discount_total' => ['nullable', 'numeric', 'min:0'],
            'down_payment_amount' => ['required', 'numeric', 'min:1'],
            'payment_method' => ['required', 'string', 'max:80'],
            'transaction_id' => ['nullable', 'string', 'max:120'],
            'proof_of_payment' => ['nullable', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'customer_signature' => ['required', 'string', 'max:500'],
            'terms_version' => ['required', 'string', 'max:40'],
        ];
    }
}
