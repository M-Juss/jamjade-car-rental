<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Enums\TelematicsEventType;
use App\Enums\TelematicsSetupStatus;
use App\Models\Booking;
use App\Models\TelematicsEvent;
use App\Models\TelematicsLocationPoint;
use App\Models\TelematicsTrip;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TelematicsService
{
    public function startTrip(User $user, array $data): TelematicsTrip
    {
        return DB::transaction(function () use ($user, $data) {
            $booking = Booking::with(['vehicle', 'telematicsSetupSession'])
                ->where('id', $data['booking_id'])
                ->lockForUpdate()
                ->firstOrFail();

            if ($booking->rental_type !== RentalType::SelfDrive || $booking->user_id !== $user->id) {
                abort(403, 'Only the renter of a self-drive booking may start this trip.');
            }

            if ($booking->status !== BookingStatus::Ongoing) {
                throw ValidationException::withMessages([
                    'booking_id' => ['Telematics can only start once the booking rental is active.'],
                ]);
            }
            if ($booking->telematicsSetupSession?->status !== TelematicsSetupStatus::Released) {
                throw ValidationException::withMessages([
                    'booking_id' => ['Telematics setup must be released before trip monitoring starts.'],
                ]);
            }

            $existingTrip = $booking->telematicsTrips()
                ->whereIn('status', ['started', 'paused', 'ended'])
                ->first();

            if ($existingTrip) {
                throw ValidationException::withMessages([
                    'booking_id' => [$existingTrip->status === 'ended'
                        ? 'This booking trip has already ended and is awaiting Jamjade return processing.'
                        : 'This booking already has an active telematics trip.'],
                ]);
            }

            $trip = TelematicsTrip::create([
                'booking_id' => $booking->id,
                'operator_user_id' => $user->id,
                'status' => 'started',
                'started_at' => now(),
                'start_latitude' => $data['latitude'],
                'start_longitude' => $data['longitude'],
                'current_latitude' => $data['latitude'],
                'current_longitude' => $data['longitude'],
                'battery_percent' => $data['battery_percent'] ?? null,
                'gps_signal_percent' => $data['gps_signal_percent'] ?? null,
                'current_zone' => $data['current_zone'] ?? null,
                'last_location_at' => now(),
            ]);

            $this->storeEvent($trip, [
                'event_type' => TelematicsEventType::TripStarted->value,
                'severity' => 'low',
                'latitude' => $data['latitude'],
                'longitude' => $data['longitude'],
                'metadata' => ['source' => 'mobile'],
            ], $user);

            activity()
                ->causedBy($user)
                ->performedOn($trip)
                ->event('telematics_trip_started')
                ->log('Authorized mobile operator started telematics trip monitoring.');

            return $trip->fresh(['booking.vehicle.images', 'events']);
        });
    }

    public function pauseTrip(TelematicsTrip $trip, User $user): TelematicsTrip
    {
        $this->assertTripOwner($trip, $user);
        $this->assertTripStatus($trip, 'started');

        $trip->update([
            'status' => 'paused',
            'paused_at' => now(),
        ]);

        $this->storeEvent($trip, [
            'event_type' => TelematicsEventType::TripPaused->value,
            'severity' => 'low',
        ], $user);

        return $trip->fresh(['booking.vehicle.images', 'events']);
    }

    public function resumeTrip(TelematicsTrip $trip, User $user): TelematicsTrip
    {
        $this->assertTripOwner($trip, $user);
        $this->assertTripStatus($trip, 'paused');

        $trip->update([
            'status' => 'started',
            'resumed_at' => now(),
        ]);

        $this->storeEvent($trip, [
            'event_type' => TelematicsEventType::TripResumed->value,
            'severity' => 'low',
        ], $user);

        return $trip->fresh(['booking.vehicle.images', 'events']);
    }

    public function endTrip(TelematicsTrip $trip, User $user, array $data = []): TelematicsTrip
    {
        $this->assertTripOwner($trip, $user);

        if ($trip->status === 'ended' && $data['event_type'] !== TelematicsEventType::TripEnded->value) {
            throw ValidationException::withMessages([
                'trip' => ['This trip is already ended.'],
            ]);
        }

        $trip->update([
            'status' => 'ended',
            'ended_at' => now(),
            'end_latitude' => $data['latitude'] ?? $trip->current_latitude,
            'end_longitude' => $data['longitude'] ?? $trip->current_longitude,
        ]);

        $this->storeEvent($trip, [
            'event_type' => TelematicsEventType::TripEnded->value,
            'severity' => 'low',
            'latitude' => $trip->end_latitude,
            'longitude' => $trip->end_longitude,
        ], $user);

        activity()->causedBy($user)->performedOn($trip)->event('telematics_trip_ended')
            ->withProperties(['booking_id' => $trip->booking_id])->log('Authorized mobile operator ended the telematics trip.');

        return $trip->fresh(['booking.vehicle.images', 'events']);
    }

    public function storeEvent(TelematicsTrip $trip, array $data, User $user): TelematicsEvent
    {
        $this->assertTripOwner($trip, $user);

        if ($trip->status === 'ended' && $data['event_type'] !== TelematicsEventType::TripEnded->value) {
            throw ValidationException::withMessages([
                'trip' => ['Cannot add telematics events to an ended trip.'],
            ]);
        }

        $event = TelematicsEvent::create([
            'trip_id' => $trip->id,
            'event_type' => $data['event_type'],
            'severity' => $data['severity'] ?? 'low',
            'latitude' => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
            'metadata' => $data['metadata'] ?? null,
            'occurred_at' => $data['occurred_at'] ?? now(),
        ]);

        return $event->fresh(['trip.booking.vehicle', 'trip.operator']);
    }

    public function storeLocation(TelematicsTrip $trip, array $data, User $user): TelematicsTrip
    {
        return DB::transaction(function () use ($trip, $data, $user) {
            $this->assertTripOwner($trip, $user);

            if ($trip->status !== 'started') {
                throw ValidationException::withMessages([
                    'trip' => ['Location updates are only accepted while the trip is started.'],
                ]);
            }

            $trip->update([
                'current_latitude' => $data['latitude'],
                'current_longitude' => $data['longitude'],
                'current_speed' => $data['speed'] ?? $trip->current_speed,
                'battery_percent' => $data['battery_percent'] ?? $trip->battery_percent,
                'gps_signal_percent' => $data['gps_signal_percent'] ?? $trip->gps_signal_percent,
                'current_zone' => $data['current_zone'] ?? $trip->current_zone,
                'last_location_at' => $data['captured_at'],
            ]);

            TelematicsLocationPoint::create([
                'telematics_trip_id' => $trip->id,
                'latitude' => $data['latitude'],
                'longitude' => $data['longitude'],
                'accuracy' => $data['accuracy'] ?? null,
                'speed' => $data['speed'] ?? null,
                'heading' => $data['heading'] ?? null,
                'captured_at' => $data['captured_at'],
                'received_at' => now(),
            ]);

            return $trip->fresh(['booking.vehicle.images', 'events']);
        });
    }

    private function assertTripOwner(TelematicsTrip $trip, User $user): void
    {
        if ($trip->operator_user_id !== $user->id) {
            abort(403, 'You can only manage your own telematics trips.');
        }
    }

    private function assertTripStatus(TelematicsTrip $trip, string $status): void
    {
        if ($trip->status !== $status) {
            throw ValidationException::withMessages([
                'trip' => ["Trip must be {$status} for this action."],
            ]);
        }
    }
}
