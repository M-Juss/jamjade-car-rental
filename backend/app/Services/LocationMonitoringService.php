<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Enums\TelematicsSetupStatus;
use App\Models\Booking;
use App\Models\DriveMonitoringSession;
use App\Models\TelematicsTrip;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class LocationMonitoringService
{
    public function bookingFor(User $user, string $code): Booking
    {
        abort_unless($user->hasAnyRole(['customer', 'driver']), 403);
        $booking = Booking::query()->where('booking_code', $code)
            ->where(function (Builder $query) use ($user) {
                if ($user->hasRole('customer')) {
                    $query->where(fn (Builder $owned) => $owned->where('rental_type', RentalType::SelfDrive->value)
                        ->where('user_id', $user->id));
                }
                if ($user->hasRole('driver')) {
                    $query->orWhere(fn (Builder $assigned) => $assigned->where('rental_type', RentalType::OwnersDriver->value)
                        ->whereHas('assignment', fn (Builder $assignment) => $assignment->where('driver_id', $user->id)));
                }
            })
            ->with(['telematicsTrip', 'telematicsSetupSession', 'returnRecord', 'assignedDriver', 'assignment'])
            ->firstOrFail();
        abort_unless(app(TelematicsOperatorService::class)->isOperator($booking, $user), 403);

        return $booking;
    }

    public function canMonitor(Booking $booking): bool
    {
        return $booking->status === BookingStatus::Ongoing
            && $booking->telematicsSetupSession?->status === TelematicsSetupStatus::Released
            && ! $booking->returnRecord?->vehicle_received_at
            && $booking->telematicsTrip?->status !== 'ended';
    }

    /** @return array{latitude: float, longitude: float, accuracy: float, sharedAt: string}|null */
    public function sharedVehicleLocationForCustomer(Booking $booking, User $customer): ?array
    {
        if ((int) $booking->user_id !== (int) $customer->id
            || $booking->rental_type !== RentalType::OwnersDriver
            || $booking->status !== BookingStatus::Ongoing
            || $booking->telematicsSetupSession?->status !== TelematicsSetupStatus::Released
            || $booking->returnRecord?->vehicle_received_at) {
            return null;
        }

        $trip = $booking->relationLoaded('telematicsTrips')
            ? $booking->telematicsTrips->first()
            : $booking->telematicsTrips()->first();
        try {
            $location = $trip?->latest_location;
        } catch (Throwable) {
            return null;
        }
        $lastSharedAt = $trip?->last_location_at;
        if (! $trip || $trip->location_consent_version !== (int) config('telematics.foreground_location.consent_version')
            || ! in_array($trip->status, ['started', 'paused'], true)
            || ! is_array($location) || ! $lastSharedAt
            || ! is_numeric($location['latitude'] ?? null)
            || ! is_numeric($location['longitude'] ?? null)
            || ! is_numeric($location['accuracy'] ?? null)
            || CarbonImmutable::instance($lastSharedAt)->addHours(config('telematics.foreground_location.retention_hours'))->lessThanOrEqualTo(now())) {
            return null;
        }

        return [
            'latitude' => (float) $location['latitude'],
            'longitude' => (float) $location['longitude'],
            'accuracy' => (float) $location['accuracy'],
            'sharedAt' => CarbonImmutable::instance($lastSharedAt)->toISOString(),
        ];
    }

    public function start(Booking $booking, User $user, array $data): array
    {
        return DB::transaction(function () use ($booking, $user, $data) {
            $booking = $this->lockedBooking($booking, $user);
            $this->assertAvailable($booking);
            $this->assertFresh($data);
            $token = Str::random(64);
            $trip = $booking->telematicsTrip;
            if (! $trip) {
                $trip = $booking->telematicsTrips()->create([
                    'operator_user_id' => $user->id, 'status' => 'started', 'started_at' => now(),
                ]);
                $this->event($trip, 'trip_started');
            } else {
                abort_unless($trip->operator_user_id === $user->id, 403);
                if ($trip->status === 'paused') {
                    $this->event($trip, 'trip_resumed');
                    $trip->resumed_at = now();
                }
            }
            $trip->fill([
                'status' => 'started', 'location_consent_at' => now(),
                'location_consent_version' => config('telematics.foreground_location.consent_version'),
                'location_session_hash' => hash('sha256', $token),
            ])->save();
            // A new sharing session cannot establish crossings during an unobserved gap.
            $trip->geofenceStates()->update([
                'inside' => null, 'uncertain' => true, 'candidate_inside' => null,
                'candidate_count' => 0, 'candidate_started_at' => null,
            ]);
            $this->saveLatest($trip, $data);
            activity()->causedBy($user)->performedOn($trip)->event('location_monitoring_consent')
                ->withProperties(['version' => $trip->location_consent_version, 'mode' => $data['sharing_mode']])
                ->log('Authorized rental operator agreed to latest-location sharing.');

            return ['booking' => $booking->fresh(['telematicsTrip', 'telematicsSetupSession', 'returnRecord']), 'sessionToken' => $token];
        });
    }

    public function update(Booking $booking, User $user, array $data): Booking
    {
        return DB::transaction(function () use ($booking, $user, $data) {
            $booking = $this->lockedBooking($booking, $user);
            $this->assertAvailable($booking);
            $trip = $this->assertSession($booking, $data['session_token']);
            if ($trip->location_consent_version !== config('telematics.foreground_location.consent_version')) {
                throw ValidationException::withMessages(['consent_version' => ['Agree to the updated location sharing terms before continuing.']]);
            }
            if ($trip->status !== 'started') {
                throw ValidationException::withMessages(['monitoring' => ['Location sharing is paused.']]);
            }
            $this->assertFresh($data);
            $this->saveLatest($trip, $data);

            return $booking;
        });
    }

    public function pause(Booking $booking, User $user, string $token, string $reason = 'manual'): Booking
    {
        return DB::transaction(function () use ($booking, $user, $token, $reason) {
            $booking = $this->lockedBooking($booking, $user);
            $trip = $this->assertSession($booking, $token);
            if ($trip->status === 'started') {
                $trip->update(['status' => 'paused', 'paused_at' => now(), 'location_session_hash' => null]);
                $this->event($trip, 'trip_paused', $reason === 'interrupted');
                if ($reason === 'manual') {
                    DriveMonitoringSession::where('telematics_trip_id', $trip->id)->where('status', 'active')->whereNull('capture_closed_ms')->update(['capture_closed_ms' => now()->getTimestampMs()]);
                }
            }

            return $booking;
        });
    }

    // Called while the booking is locked by receipt/return; never changes legacy history.
    public function close(Booking $booking): void
    {
        $trip = $booking->telematicsTrips()->whereNotNull('location_consent_version')->lockForUpdate()->first();
        if (! $trip) {
            return;
        }
        if ($trip->status !== 'ended') {
            $this->event($trip, 'trip_ended');
        }
        DriveMonitoringSession::where('telematics_trip_id', $trip->id)->where('status', 'active')->whereNull('capture_closed_ms')->update(['capture_closed_ms' => now()->getTimestampMs()]);
        $trip->update(['status' => 'ended', 'ended_at' => $trip->ended_at ?? now(), 'latest_location' => null, 'location_session_hash' => null]);
    }

    public function purgeExpiredLocations(): int
    {
        return TelematicsTrip::whereNotNull('latest_location')
            ->where('last_location_at', '<=', now()->subHours(config('telematics.foreground_location.retention_hours')))
            ->update(['latest_location' => null]);
    }

    private function lockedBooking(Booking $booking, User $user): Booking
    {
        $booking = Booking::whereKey($booking->id)->lockForUpdate()
            ->with(['telematicsSetupSession', 'returnRecord', 'assignedDriver', 'assignment'])->firstOrFail();
        abort_unless(app(TelematicsOperatorService::class)->isOperator($booking, $user), 403);
        $booking->setRelation('telematicsTrip', $booking->telematicsTrips()->lockForUpdate()->first());

        return $booking;
    }

    private function assertAvailable(Booking $booking): void
    {
        if (! $this->canMonitor($booking)) {
            throw ValidationException::withMessages(['monitoring' => ['Location sharing is unavailable for this rental.']]);
        }
    }

    private function assertSession(Booking $booking, string $token): TelematicsTrip
    {
        $trip = $booking->telematicsTrip;
        if (! $trip?->location_session_hash || ! hash_equals($trip->location_session_hash, hash('sha256', $token))) {
            throw ValidationException::withMessages(['session_token' => ['Location sharing must be started again.']]);
        }

        return $trip;
    }

    private function assertFresh(array $data): void
    {
        $captured = CarbonImmutable::parse($data['captured_at']);
        if ($captured->lt(now()->subSeconds(config('telematics.foreground_location.maximum_age_seconds')))
            || $captured->gt(now()->addSeconds(config('telematics.foreground_location.future_skew_seconds')))) {
            throw ValidationException::withMessages(['captured_at' => ['A fresh location reading is required.']]);
        }
    }

    private function saveLatest(TelematicsTrip $trip, array $data): void
    {
        $captured = CarbonImmutable::parse($data['captured_at'])->utc()->startOfSecond();
        if ($trip->last_location_at && $captured->lessThanOrEqualTo($trip->last_location_at)) {
            return;
        }
        $trip->update([
            'latest_location' => ['latitude' => (float) $data['latitude'], 'longitude' => (float) $data['longitude'], 'accuracy' => (float) $data['accuracy']],
            'last_location_at' => $captured,
        ]);
        // Reuse server crossing rules without writing location-point history.
        app(GeofenceMonitoringService::class)->evaluateLocation($trip, [...$data, 'captured_at' => $captured]);
    }

    private function event(TelematicsTrip $trip, string $type, bool $interrupted = false): void
    {
        $trip->events()->create(['event_type' => $type, 'severity' => 'low', 'metadata' => ['source' => 'foreground_latest'], 'occurred_at' => now()]);
        [$title, $message] = match ($type) {
            'trip_started' => ['GPS monitoring started', 'Your rental’s GPS monitoring has started.'],
            'trip_resumed' => ['GPS monitoring resumed', 'Your rental’s GPS monitoring has resumed.'],
            'trip_paused' => $interrupted
                ? ['GPS monitoring interrupted', 'GPS monitoring was interrupted. Open Telematics to check access and resume while safely parked.']
                : ['GPS monitoring stopped', 'GPS monitoring has stopped. Open Telematics to resume while safely parked.'],
            'trip_ended' => ['Rental monitoring ended', 'Staff received the vehicle. GPS monitoring has ended.'],
        };
        app(NotificationService::class)->createForTelematicsParticipants($trip->booking, $title, $message, [
            'action' => 'view_telematics_activity', 'action_label' => 'View activity',
            'event_type' => $type,
        ]);
    }
}
