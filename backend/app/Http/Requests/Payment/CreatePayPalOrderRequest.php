<?php

namespace App\Http\Requests\Payment;

use App\Http\Requests\BaseFormRequest;
use App\Support\PayPalAppUrl;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Validation\Rule;

class CreatePayPalOrderRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $driverOption = $this->input('driver_option');
        $pickupLocationTypes = $driverOption === 'self_drive' ? ['shop'] : ['shop', 'delivery'];

        return [
            'vehicle_id' => ['required', 'exists:vehicles,id'],
            'rental_start_at' => [
                'required',
                'date',
                'after_or_equal:today',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (! is_string($value) || ! str_contains($value, ':')) {
                        return;
                    }

                    try {
                        $rentalStart = CarbonImmutable::parse($value);
                    } catch (\Throwable) {
                        return;
                    }

                    if ($rentalStart->lessThanOrEqualTo(now())) {
                        $fail('The pickup time must be later than the current time.');
                    }
                },
            ],
            'rental_end_at' => ['required', 'date', 'after:rental_start_at'],
            'pickup_location_type' => ['required', Rule::in($pickupLocationTypes)],
            'pickup_location' => ['required', 'string', 'max:255'],
            'return_location' => ['required', 'string', 'max:255'],
            'driver_option' => ['required', 'in:self_drive,owners_driver'],
            'owner_driver_coverage' => ['nullable', 'required_if:driver_option,owners_driver', 'in:metro_manila,outside_manila'],
            'delivery_quote_id' => ['nullable', 'required_if:pickup_location_type,delivery', 'uuid', 'prohibited_if:pickup_location_type,shop'],
            'delivery_fee' => ['prohibited'],
            'delivery_toll_fee' => ['prohibited'],
            'add_ons_total' => ['prohibited'],
            'discount_total' => ['prohibited'],
            'payment_option' => ['required', 'in:down_payment,full_payment'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'customer_signature' => ['required', 'string'],
            'terms_version' => ['required', 'string', 'max:40'],
            'reviewed_pricing' => ['required_if:terms_version,2026-10-15-v2,2026-10-17-v3,2026-10-19-v4', 'array:price_per_day,subtotal,delivery_fee,delivery_toll_fee,owner_driver_fee,total_amount'],
            'reviewed_pricing.price_per_day' => ['required_with:reviewed_pricing', 'numeric', 'min:0'],
            'reviewed_pricing.subtotal' => ['required_with:reviewed_pricing', 'numeric', 'min:0'],
            'reviewed_pricing.delivery_fee' => ['required_with:reviewed_pricing', 'numeric', 'min:0'],
            'reviewed_pricing.delivery_toll_fee' => ['required_with:reviewed_pricing', 'numeric', 'min:0'],
            'reviewed_pricing.owner_driver_fee' => ['required_with:reviewed_pricing', 'numeric', 'min:0'],
            'reviewed_pricing.total_amount' => ['required_with:reviewed_pricing', 'numeric', 'min:0'],
            'late_return_policy_version' => ['required', 'string', 'size:64'],
            'app_return_url' => $this->appUrlRules(),
            'app_cancel_url' => $this->appUrlRules(),
        ];
    }

    private function appUrlRules(): array
    {
        return [
            'required',
            'string',
            'max:2048',
            function (string $attribute, mixed $value, Closure $fail) {
                if (! is_string($value) || ! PayPalAppUrl::isAllowed($value)) {
                    $fail("The {$attribute} must be a valid JamJade app callback URL.");
                }
            },
        ];
    }
}
