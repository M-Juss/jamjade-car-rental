<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Enums\TelematicsEventType;
use App\Models\Booking;
use App\Models\GeofenceLog;
use App\Models\TelematicsEvent;
use App\Models\TelematicsTrip;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TelematicsService
{
    public function __construct(private readonly GeofenceService $geofenceService) {}

    public function startTrip(User $user, array $data): TelematicsTrip
    {
        return DB::transaction(function () use ($user, $data) {
            $booking = Booking::with(['vehicle', 'assignedDriver'])
                ->where('id', $data['booking_id'])
                ->lockForUpdate()
                ->firstOrFail();

            $operatorId = $booking->rental_type === RentalType::SelfDrive
                ? $booking->user_id
                : $booking->assigned_driver_id;
            if ($operatorId !== $user->id) {
                abort(403, 'Only the authorized renter or assigned Driver may start this trip.');
            }

            if ($booking->status !== BookingStatus::Ongoing) {
                throw ValidationException::withMessages([
                    'booking_id' => ['Telematics can only start once the booking rental is active.'],
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
                'user_id' => $user->id,
                'vehicle_id' => $booking->vehicle_id,
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
                'event_type' => TelematicsEventType::StartTrip->value,
                'severity' => 'low',
                'latitude' => $data['latitude'],
                'longitude' => $data['longitude'],
                'description' => 'Trip started from mobile app.',
            ], $user);

            activity()
                ->causedBy($user)
                ->performedOn($trip)
                ->event('telematics_trip_started')
                ->log('Authorized mobile operator started telematics trip monitoring.');

            return $trip->fresh(['booking.vehicle.images', 'vehicle.images', 'events']);
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
            'event_type' => TelematicsEventType::Pause->value,
            'severity' => 'low',
            'description' => 'Trip paused by customer.',
        ], $user);

        return $trip->fresh(['booking.vehicle.images', 'vehicle.images', 'events']);
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
            'event_type' => TelematicsEventType::Resume->value,
            'severity' => 'low',
            'description' => 'Trip resumed by customer.',
        ], $user);

        return $trip->fresh(['booking.vehicle.images', 'vehicle.images', 'events']);
    }

    public function endTrip(TelematicsTrip $trip, User $user, array $data = []): TelematicsTrip
    {
        $this->assertTripOwner($trip, $user);

        if ($trip->status === 'ended') {
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

        activity()->causedBy($user)->performedOn($trip)->event('telematics_trip_ended')
            ->withProperties(['booking_id' => $trip->booking_id])->log('Authorized mobile operator ended the telematics trip.');

        return $trip->fresh(['booking.vehicle.images', 'vehicle.images', 'events', 'geofenceLogs']);
    }

    public function storeEvent(TelematicsTrip $trip, array $data, User $user): TelematicsEvent
    {
        $this->assertTripOwner($trip, $user);

        if ($trip->status === 'ended') {
            throw ValidationException::withMessages([
                'trip' => ['Cannot add telematics events to an ended trip.'],
            ]);
        }

        $event = TelematicsEvent::create([
            'trip_id' => $trip->id,
            'booking_id' => $trip->booking_id,
            'user_id' => $trip->user_id,
            'vehicle_id' => $trip->vehicle_id,
            'event_type' => $data['event_type'],
            'severity' => $data['severity'] ?? 'low',
            'latitude' => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
            'speed' => $data['speed'] ?? null,
            'accelerometer_x' => $data['accelerometer_x'] ?? null,
            'accelerometer_y' => $data['accelerometer_y'] ?? null,
            'accelerometer_z' => $data['accelerometer_z'] ?? null,
            'gyroscope_x' => $data['gyroscope_x'] ?? null,
            'gyroscope_y' => $data['gyroscope_y'] ?? null,
            'gyroscope_z' => $data['gyroscope_z'] ?? null,
            'description' => $data['description'] ?? null,
            'occurred_at' => $data['occurred_at'] ?? now(),
        ]);

        return $event->fresh(['booking', 'vehicle']);
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
                'last_location_at' => $data['occurred_at'] ?? now(),
            ]);

            $this->storeEvent($trip, [
                'event_type' => TelematicsEventType::Location->value,
                'severity' => 'low',
                'latitude' => $data['latitude'],
                'longitude' => $data['longitude'],
                'speed' => $data['speed'] ?? null,
                'occurred_at' => $data['occurred_at'] ?? now(),
            ], $user);

            if (isset($data['geofence_status'])) {
                GeofenceLog::create([
                    'trip_id' => $trip->id,
                    'booking_id' => $trip->booking_id,
                    'user_id' => $trip->user_id,
                    'vehicle_id' => $trip->vehicle_id,
                    'status' => $data['geofence_status'],
                    'latitude' => $data['latitude'],
                    'longitude' => $data['longitude'],
                    'distance_from_allowed_area' => $data['distance_from_allowed_area'] ?? null,
                    'current_area' => $data['current_zone'] ?? null,
                    'allowed_area' => $trip->allowed_zone,
                    'occurred_at' => $data['occurred_at'] ?? now(),
                ]);

                if (in_array($data['geofence_status'], ['outside', 'gps_unavailable'], true)) {
                    $this->storeEvent($trip, [
                        'event_type' => $data['geofence_status'] === 'outside'
                            ? TelematicsEventType::GeofenceExit->value
                            : TelematicsEventType::GpsLost->value,
                        'severity' => $this->geofenceService->severityForStatus($data['geofence_status']),
                        'latitude' => $data['latitude'],
                        'longitude' => $data['longitude'],
                        'description' => 'Geofence status: '.$data['geofence_status'],
                        'occurred_at' => $data['occurred_at'] ?? now(),
                    ], $user);
                }
            }

            return $trip->fresh(['booking.vehicle.images', 'vehicle.images', 'events', 'geofenceLogs']);
        });
    }

    private function assertTripOwner(TelematicsTrip $trip, User $user): void
    {
        if ($trip->user_id !== $user->id) {
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
