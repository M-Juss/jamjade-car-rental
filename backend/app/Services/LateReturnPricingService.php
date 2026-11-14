<?php

namespace App\Services;

use App\Models\LateReturnPricingSetting;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Support\Facades\DB;

class LateReturnPricingService
{
    public function settings(): array
    {
        $settings = LateReturnPricingSetting::current();

        return [
            'small_vehicle_hourly_rate' => (float) $settings->small_vehicle_hourly_rate,
            'large_vehicle_hourly_rate' => (float) $settings->large_vehicle_hourly_rate,
        ];
    }

    public function policy(Vehicle $vehicle, ?array $rates = null): array
    {
        $rates ??= $this->settings();
        $policy = [
            'seats' => (int) $vehicle->seats,
            'seatBracket' => $vehicle->seats <= 5 ? 'up_to_5' : '6_and_above',
            'hourlyRate' => $vehicle->seats <= 5 ? $rates['small_vehicle_hourly_rate'] : $rates['large_vehicle_hourly_rate'],
            'minimumHours' => 1,
            'roundUpAfterMinutes' => 30,
            'dailyConversion' => false,
        ];
        $policy['version'] = hash('sha256', json_encode($policy));

        return $policy;
    }

    public function update(User $actor, array $data): array
    {
        return DB::transaction(function () use ($actor, $data) {
            LateReturnPricingSetting::current();
            $settings = LateReturnPricingSetting::lockForUpdate()->findOrFail(1);
            $before = $settings->only(['small_vehicle_hourly_rate', 'large_vehicle_hourly_rate']);
            $settings->update($data);
            activity('late-return-pricing')->performedOn($settings)->causedBy($actor)
                ->event('late_pricing_updated')
                ->withProperties(['before' => $before, 'after' => $data])->log('Late return pricing updated');

            return $this->settings();
        });
    }
}
