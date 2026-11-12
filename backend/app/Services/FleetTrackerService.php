<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\TelematicsSetupStatus;
use App\Models\Booking;
use App\Models\Notification;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class FleetTrackerService
{
    public const TRACKING_STATUSES = [
        'not_started', 'awaiting_location', 'recent_location', 'no_recent_updates', 'paused', 'ended', 'unavailable',
    ];

    public const TRACKING_FILTERS = [
        'updating' => ['recent_location'],
        'paused' => ['paused'],
        'no_updates' => ['no_recent_updates'],
        'not_tracking' => ['not_started', 'awaiting_location', 'ended', 'unavailable'],
    ];

    public function rentals(array $filters, int $viewerId): array
    {
        $query = Booking::query()->where('status', BookingStatus::Ongoing);
        $totalOngoing = (clone $query)->count();
        $cutoff = CarbonImmutable::now()->subSeconds(config('telematics.fleet_location_recent_seconds'));

        $search = $filters['search'] ?? null;
        if ($search !== null && $search !== '') {
            $query->where(function (Builder $query) use ($search) {
                $query->where('booking_code', 'like', '%'.$search.'%')
                    ->orWhereHas('vehicle', fn (Builder $vehicle) => $vehicle
                        ->where('name', 'like', '%'.$search.'%')->orWhere('plate_number', 'like', '%'.$search.'%'))
                    ->orWhereHas('user', fn (Builder $user) => $user->where('name', 'like', '%'.$search.'%'))
                    ->orWhereHas('assignedDriver', fn (Builder $driver) => $driver->where('name', 'like', '%'.$search.'%'))
                    ->orWhereHas('telematicsTrip.operator', fn (Builder $operator) => $operator->where('name', 'like', '%'.$search.'%'))
                    ->orWhereHas('user.customerProfile', fn (Builder $profile) => $profile
                        ->where('first_name', 'like', '%'.$search.'%')->orWhere('last_name', 'like', '%'.$search.'%'));
            });
        }
        if ($type = $filters['rental_type'] ?? null) {
            $query->where('rental_type', $type);
        }
        if ($status = $filters['status'] ?? null) {
            $this->filterTrackingStatus($query, $status, $cutoff);
        }
        if ($state = $filters['tracking_state'] ?? null) {
            $query->where(function (Builder $group) use ($state, $cutoff) {
                foreach (self::TRACKING_FILTERS[$state] as $status) {
                    $group->orWhere(fn (Builder $item) => $this->filterTrackingStatus($item, $status, $cutoff));
                }
            });
        }

        $rentals = $query->select(['id', 'booking_code', 'user_id', 'vehicle_id', 'rental_type', 'rental_start_at', 'rental_end_at'])
            ->with([
                'user:id,name,email,phone_number', 'user.customerProfile:id,user_id,first_name,last_name',
                'user.emergencyContacts:id,user_id,name,relationship,phone_number',
                'assignedDriver:users.id,users.name,users.email,users.phone_number',
                'vehicle:id,brand,name,model,plate_number',
                'telematicsTrip:id,booking_id,operator_user_id,status,last_location_at,latest_location,location_consent_at,location_consent_version',
                'telematicsTrip.operator:id,name,email,phone_number',
                'telematicsSetupSession:id,booking_id,status', 'returnRecord:id,booking_id,vehicle_received_at',
            ])
            ->withCount('telematicsEvents')
            ->orderBy('rental_end_at')->orderBy('id')
            ->paginate($filters['per_page'] ?? 15);

        $bookingIds = $rentals->getCollection()->modelKeys();
        $drivingCounts = DB::table('drive_monitoring_events as event')
            ->join('drive_monitoring_sessions as capture', 'capture.id', '=', 'event.session_id')
            ->join('telematics_trips as trip', 'trip.id', '=', 'capture.telematics_trip_id')
            ->whereIn('trip.booking_id', $bookingIds)
            ->whereIn('event.status', ['confirmed', 'review_required'])
            ->selectRaw('trip.booking_id, count(*) as total')->groupBy('trip.booking_id')
            ->pluck('total', 'booking_id');
        $notificationCounts = Notification::query()->where('user_id', $viewerId)
            ->whereIn('booking_id', $bookingIds)->whereNull('read_at')
            ->selectRaw('booking_id, count(*) as total')->groupBy('booking_id')
            ->pluck('total', 'booking_id');

        $rentals->setCollection($rentals->getCollection()->map(fn (Booking $booking) => [
            'booking' => $booking, 'trackingStatus' => $this->trackingStatus($booking, $cutoff),
            'location' => $this->latestLocation($booking),
            'activityCounts' => [
                'driving' => (int) ($drivingCounts[$booking->id] ?? 0),
                'trip' => (int) $booking->telematics_events_count,
                'unreadNotifications' => (int) ($notificationCounts[$booking->id] ?? 0),
            ],
        ]));

        return ['rentals' => $rentals, 'totalOngoing' => $totalOngoing];
    }

    private function latestLocation(Booking $booking): ?array
    {
        $trip = $booking->telematicsTrip;
        if (! app(TelematicsOperatorService::class)->supports($booking)
            || $booking->telematicsSetupSession?->status !== TelematicsSetupStatus::Released
            || $booking->returnRecord?->vehicle_received_at
            || ! $trip?->location_consent_at || ! $trip->location_consent_version
            || $trip->status === 'ended' || ! $trip->last_location_at) {
            return null;
        }
        $expires = $trip->last_location_at->copy()->addHours(config('telematics.foreground_location.retention_hours'));
        if ($expires->lessThanOrEqualTo(now())) {
            return null;
        }
        try {
            $point = $trip->latest_location;
        } catch (DecryptException) {
            return null;
        }
        if (! is_array($point)) {
            return null;
        }
        foreach (['latitude' => 90, 'longitude' => 180, 'accuracy' => config('telematics.foreground_location.maximum_accuracy_meters')] as $key => $maximum) {
            if (! isset($point[$key]) || ! is_numeric($point[$key]) || ! is_finite((float) $point[$key])
                || abs((float) $point[$key]) > $maximum) {
                return null;
            }
        }
        if ($point['accuracy'] < 0) {
            return null;
        }

        return [
            'latitude' => (float) $point['latitude'], 'longitude' => (float) $point['longitude'],
            'accuracy' => (float) $point['accuracy'], 'expiresAt' => $expires->toISOString(),
        ];
    }

    private function trackingStatus(Booking $booking, CarbonImmutable $cutoff): string
    {
        if (! app(TelematicsOperatorService::class)->supports($booking)
            || $booking->telematicsSetupSession?->status !== TelematicsSetupStatus::Released) {
            return 'unavailable';
        }
        $trip = $booking->telematicsTrip;
        if (! $trip) {
            return 'not_started';
        }
        if (in_array($trip->status, ['paused', 'ended'], true)) {
            return $trip->status;
        }
        if (! $trip->last_location_at) {
            return 'awaiting_location';
        }

        return $trip->last_location_at->greaterThanOrEqualTo($cutoff) ? 'recent_location' : 'no_recent_updates';
    }

    private function filterTrackingStatus(Builder $query, string $status, CarbonImmutable $cutoff): void
    {
        if ($status === 'unavailable') {
            $query->whereDoesntHave('telematicsSetupSession', fn (Builder $session) => $session->where('status', TelematicsSetupStatus::Released->value));

            return;
        }
        $query->whereHas('telematicsSetupSession', fn (Builder $session) => $session->where('status', TelematicsSetupStatus::Released->value));
        if ($status === 'not_started') {
            $query->whereDoesntHave('telematicsTrip');

            return;
        }
        $query->whereHas('telematicsTrip', function (Builder $trip) use ($status, $cutoff) {
            if (in_array($status, ['paused', 'ended'], true)) {
                $trip->where('status', $status);

                return;
            }
            $trip->where('status', 'started');
            match ($status) {
                'awaiting_location' => $trip->whereNull('last_location_at'),
                'recent_location' => $trip->where('last_location_at', '>=', $cutoff),
                'no_recent_updates' => $trip->where('last_location_at', '<', $cutoff),
            };
        });
    }
}
