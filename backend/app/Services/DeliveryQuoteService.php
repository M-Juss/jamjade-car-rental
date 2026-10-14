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
    public function __construct(private readonly DeliveryMapsService $maps, private readonly NotificationService $notifications) {}

    public function routes(User $user, array $data): array
    {
        $settings = DeliveryPricingSetting::current();
        if ($settings->garage_latitude === null || $settings->garage_longitude === null) {
            $this->fail('The garage map location must be configured before delivery can be quoted.');
        }
        $vehicle = Vehicle::findOrFail($data['vehicle_id']);
        $start = CarbonImmutable::parse($data['rental_start_at'])->utc();
        $end = CarbonImmutable::parse($data['rental_end_at'])->utc();
        $days = max(1, (int) ceil($start->diffInRealHours($end) / 24));
        $routes = $this->maps->routes(['latitude' => $settings->garage_latitude, 'longitude' => $settings->garage_longitude], ['latitude' => (float) $data['latitude'], 'longitude' => (float) $data['longitude']]);

        return DB::transaction(function () use ($routes, $settings, $user, $data, $vehicle, $start, $end, $days) {
            $result = [];
            foreach ($routes as $i => $r) {
                $toll = isset($r['travelAdvisory']['tollInfo']) ? 'toll' : 'toll_free';
                $q = DeliveryQuote::create(['user_id' => $user->id, 'vehicle_id' => $vehicle->id, 'rental_start_at' => $start, 'rental_end_at' => $end, 'owner_driver_coverage' => $data['owner_driver_coverage'],
                    'destination_address' => $data['destination_address'], 'destination_place_id' => $data['destination_place_id'] ?? null, 'destination_point' => ['latitude' => (float) $data['latitude'], 'longitude' => (float) $data['longitude']], 'point_expires_at' => now()->addDays(30),
                    'pricing_snapshot' => $settings->snapshot(), 'price_per_day' => $vehicle->price_per_day, 'duration_days' => $days, 'subtotal' => $vehicle->price_per_day * $days, 'owner_driver_fee' => ($data['owner_driver_coverage'] === 'outside_manila' ? 1000 : 700) * $days,
                    'delivery_fee' => $settings->fee((int) $r['distanceMeters']), 'route_fingerprint' => $this->fingerprint($r), 'route_label' => 'Route '.($i + 1), 'toll_status' => $toll, 'status' => 'offered', 'expires_at' => now()->addMinutes(15)]);
                // Provider route geometry is returned for immediate map display, never persisted.
                $result[] = ['quote' => $q, 'distanceMeters' => $r['distanceMeters'], 'durationSeconds' => (int) rtrim($r['duration'], 's'), 'encodedPolyline' => $r['polyline']['encodedPolyline'] ?? null];
            }

            return $result;
        });
    }

    public function select(DeliveryQuote $quote, User $user): DeliveryQuote
    {
        abort_unless($quote->user_id === $user->id, 404);

        return DB::transaction(function () use ($quote) {
            $q = DeliveryQuote::lockForUpdate()->findOrFail($quote->id);
            if ($q->effectiveStatus() !== 'offered') {
                $this->fail('This route offer has expired or was already selected. Get new routes.');
            }
            // A new selection replaces any unconsumed quote for the same vehicle/schedule.
            DeliveryQuote::where('user_id', $q->user_id)
                ->where('vehicle_id', $q->vehicle_id)
                ->where('rental_start_at', $q->rental_start_at)
                ->where('rental_end_at', $q->rental_end_at)
                ->where('id', '!=', $q->id)
                ->whereIn('status', ['offered', 'ready', 'awaiting_review'])
                ->update(['status' => 'superseded', 'expires_at' => null]);
            $q->update($q->toll_status === 'toll_free' ? ['status' => 'ready', 'delivery_toll_fee' => 0, 'expires_at' => now()->addMinutes(15)] : ['status' => 'awaiting_review', 'expires_at' => null, 'review_deadline' => $q->point_expires_at]);

            return $q;
        }, 3);
    }

    public function review(DeliveryQuote $quote, User $actor, array $data): DeliveryQuote
    {
        if ($data['decision'] === 'approve') {
            $this->selectedRoute($quote);
        }

        return DB::transaction(function () use ($quote, $actor, $data) {
            $q = DeliveryQuote::lockForUpdate()->findOrFail($quote->id);
            if ($q->effectiveStatus() !== 'awaiting_review') {
                $this->fail('This request is no longer awaiting toll review.');
            }
            $q->update(['status' => $data['decision'] === 'approve' ? 'ready' : 'rejected', 'delivery_toll_fee' => $data['decision'] === 'approve' ? $data['delivery_toll_fee'] : null, 'expires_at' => $data['decision'] === 'approve' ? now()->addMinutes(15) : null, 'reviewed_by' => $actor->id, 'reviewed_at' => now(), 'review_note' => $data['review_note'] ?? null]);
            $this->notifications->createForUser($q->user, 'system', $data['decision'] === 'approve' ? 'Delivery quote approved' : 'Delivery request rejected', $data['decision'] === 'approve' ? 'Your complete delivery quote is ready. Return to booking within 15 minutes to accept it.' : 'Your delivery request was rejected. Review the staff note before selecting a new route.', ['action' => 'view_delivery_quote', 'deliveryQuoteId' => $q->id, 'vehicleId' => (string) $q->vehicle_id, 'action_label' => 'View Delivery Quote']);
            activity('delivery-quotes')->performedOn($q)->causedBy($actor)->withProperties(['decision' => $data['decision'], 'delivery_toll_fee' => $q->delivery_toll_fee])->log('Delivery toll quote reviewed');

            return $q;
        });
    }

    // Called inside the booking transaction. Locks prevent two payments consuming one quote.
    public function forBooking(User $user, array $data): DeliveryQuote
    {
        $q = DeliveryQuote::lockForUpdate()->find($data['delivery_quote_id'] ?? null);
        if (! $q || $q->user_id !== $user->id || $q->effectiveStatus() !== 'ready') {
            $this->fail('A valid, complete delivery quote is required. Return to delivery route selection.');
        }
        if ($data['driver_option'] !== 'owners_driver' || (int) $data['vehicle_id'] !== $q->vehicle_id || $data['owner_driver_coverage'] !== $q->owner_driver_coverage || ! CarbonImmutable::parse($data['rental_start_at'])->equalTo($q->rental_start_at) || ! CarbonImmutable::parse($data['rental_end_at'])->equalTo($q->rental_end_at) || $data['pickup_location'] !== $q->destination_address || $data['return_location'] !== $q->destination_address) {
            $this->fail('Booking details changed. Request a new delivery quote.');
        }

        return $q;
    }

    public function selectedRoute(DeliveryQuote $quote): array
    {
        if ($quote->effectiveStatus() !== 'awaiting_review' || ! $quote->destination_point || $quote->point_expires_at->isPast()) {
            $this->fail('This delivery request is no longer available for review.');
        }
        $settings = $quote->pricing_snapshot;
        $routes = $this->maps->routes(['latitude' => $settings['garage_latitude'], 'longitude' => $settings['garage_longitude']], $quote->destination_point);
        foreach ($routes as $route) {
            if (hash_equals($quote->route_fingerprint, $this->fingerprint($route))) {
                return ['distanceMeters' => $route['distanceMeters'], 'durationSeconds' => (int) rtrim($route['duration'], 's'), 'encodedPolyline' => $route['polyline']['encodedPolyline'] ?? null];
            }
        }
        $this->fail('The selected route is no longer available. Reject this request and ask the customer to select a new route.');
    }

    public function purgeExpiredProviderData(): int
    {
        $count = DeliveryQuote::where('point_expires_at', '<=', now())->whereNotNull('destination_point')->update(['destination_point' => null]);
        DeliveryQuote::where('status', 'offered')->where('expires_at', '<', now()->subDay())->delete();

        return $count;
    }

    private function fingerprint(array $route): string
    {
        // A non-reconstructable identifier binds the choice without retaining provider geometry.
        return hash('sha256', json_encode([$route['distanceMeters'], $route['polyline']['encodedPolyline'] ?? null]));
    }

    private function fail(string $message): never
    {
        throw ValidationException::withMessages(['delivery_quote_id' => [$message]]);
    }
}
