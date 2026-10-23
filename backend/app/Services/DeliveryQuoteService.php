<?php

namespace App\Services;

use App\Models\DeliveryPricingSetting;
use App\Models\DeliveryQuote;
use App\Models\User;
use App\Models\Vehicle;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DeliveryQuoteService
{
    public function __construct(private readonly DeliveryMapsService $maps) {}

    public const POLICY_VERSION = '2026-10-17-deferred-tolls';

    public function confirm(User $user, array $data): array
    {
        $settings = DeliveryPricingSetting::current();
        if ($settings->garage_latitude === null || $settings->garage_longitude === null) {
            $this->fail('The garage map location must be configured before delivery can be quoted.');
        }
        $vehicle = Vehicle::findOrFail($data['vehicle_id']);
        $start = CarbonImmutable::parse($data['rental_start_at'])->utc();
        $end = CarbonImmutable::parse($data['rental_end_at'])->utc();
        $days = max(1, (int) ceil($start->diffInRealHours($end) / 24));
        $point = ['latitude' => (float) $data['latitude'], 'longitude' => (float) $data['longitude']];
        $estimate = $this->estimate($settings->snapshot(), $point);

        return DB::transaction(function () use ($estimate, $settings, $user, $data, $vehicle, $start, $end, $days, $point) {
            // Serialize confirmations for this customer so concurrent requests cannot leave two ready quotes.
            User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            DeliveryQuote::where('user_id', $user->id)
                ->where('vehicle_id', $vehicle->id)
                ->where('rental_start_at', $start)
                ->where('rental_end_at', $end)
                ->whereIn('status', ['offered', 'ready', 'awaiting_review'])
                ->update(['status' => 'superseded', 'expires_at' => null]);
            $quote = DeliveryQuote::create([
                'user_id' => $user->id, 'vehicle_id' => $vehicle->id,
                'rental_start_at' => $start, 'rental_end_at' => $end,
                'owner_driver_coverage' => $data['owner_driver_coverage'],
                'destination_address' => $data['destination_address'],
                'destination_place_id' => $data['destination_place_id'] ?? null,
                'destination_point' => $point, 'point_expires_at' => now()->addDays(30),
                'pricing_snapshot' => [...$settings->snapshot(), 'policy_version' => self::POLICY_VERSION],
                'price_per_day' => $vehicle->price_per_day, 'duration_days' => $days,
                'subtotal' => $vehicle->price_per_day * $days,
                'owner_driver_fee' => ($data['owner_driver_coverage'] === 'outside_manila' ? 1000 : 700) * $days,
                'delivery_fee' => $settings->fee($estimate['distanceMeters']),
                'delivery_toll_fee' => 0, 'toll_status' => 'deferred',
                'route_fingerprint' => hash('sha256', json_encode($estimate)),
                'route_label' => 'Automatic estimate',
                'status' => 'ready', 'expires_at' => now()->addMinutes(15),
            ]);

            // Provider distance/time stay transient; only the accepted financial snapshot is stored.
            return ['quote' => $quote, ...$estimate];
        }, 3);
    }

    public function currentEstimate(DeliveryQuote $quote): array
    {
        if (! $quote->destination_point || ! $quote->point_expires_at?->isFuture()) {
            $this->fail('The saved map point expired. Use the delivery address to confirm directions.');
        }

        return $this->estimate($quote->pricing_snapshot, $quote->destination_point);
    }

    private function estimate(array $settings, array $point): array
    {
        if (! isset($settings['garage_latitude'], $settings['garage_longitude'])) {
            $this->fail('The garage map location is unavailable.');
        }
        $routes = $this->maps->routes([
            'latitude' => $settings['garage_latitude'], 'longitude' => $settings['garage_longitude'],
        ], $point);
        usort($routes, fn (array $a, array $b) => (float) rtrim($a['duration'], 's') <=> (float) rtrim($b['duration'], 's')
            ?: $a['distanceMeters'] <=> $b['distanceMeters']);

        return ['distanceMeters' => $routes[0]['distanceMeters'], 'durationSeconds' => (float) rtrim($routes[0]['duration'], 's')];
    }

    // Called inside the booking transaction. Locks prevent two payments consuming one quote.
    public function forBooking(User $user, array $data): DeliveryQuote
    {
        $q = DeliveryQuote::lockForUpdate()->find($data['delivery_quote_id'] ?? null);
        if (! $q || $q->user_id !== $user->id || $q->effectiveStatus() !== 'ready' || ($q->pricing_snapshot['policy_version'] ?? null) !== self::POLICY_VERSION || (float) $q->delivery_toll_fee !== 0.0) {
            $this->fail('A valid, complete delivery quote is required. Confirm the delivery location again.');
        }
        if ($data['driver_option'] !== 'owners_driver' || (int) $data['vehicle_id'] !== $q->vehicle_id || $data['owner_driver_coverage'] !== $q->owner_driver_coverage || ! CarbonImmutable::parse($data['rental_start_at'])->equalTo($q->rental_start_at) || ! CarbonImmutable::parse($data['rental_end_at'])->equalTo($q->rental_end_at) || $data['pickup_location'] !== $q->destination_address || $data['return_location'] !== $q->destination_address) {
            $this->fail('Booking details changed. Request a new delivery quote.');
        }

        return $q;
    }

    public function purgeExpiredProviderData(): int
    {
        $count = DeliveryQuote::where('point_expires_at', '<=', now())->whereNotNull('destination_point')->update(['destination_point' => null]);
        DeliveryQuote::where('status', 'offered')->where('expires_at', '<', now()->subDay())->delete();

        return $count;
    }

    private function fail(string $message): never
    {
        throw ValidationException::withMessages(['delivery_quote_id' => [$message]]);
    }
}
