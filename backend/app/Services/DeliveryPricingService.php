<?php

namespace App\Services;

use App\Models\DeliveryPricingSetting;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class DeliveryPricingService
{
    public function update(User $actor, array $data): array
    {
        return DB::transaction(function () use ($actor, $data) {
            DeliveryPricingSetting::current();
            $settings = DeliveryPricingSetting::lockForUpdate()->findOrFail(1);
            $before = $settings->snapshot();
            $settings->update($data);
            activity('delivery-pricing')->performedOn($settings)->causedBy($actor)->event('delivery_pricing_updated')->withProperties(['before' => $before, 'after' => $settings->snapshot()])->log('Delivery pricing updated');

            return $settings->snapshot();
        });
    }
}
