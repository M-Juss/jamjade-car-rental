<?php

namespace App\Services;

use App\Enums\TelematicsEventType;
use App\Models\TelematicsEvent;
use App\Models\TelematicsTrip;
use Carbon\CarbonImmutable;

class GeofenceMonitoringService
{
    public function evaluateLocation(TelematicsTrip $trip, array $data): void
    {
        // Both location ingestion paths hold the trip lock. Each zone has
        // independent membership, including overlapping zones and no-zone trips.
        $capturedAt = CarbonImmutable::parse($data['captured_at']);
        $accuracy = $data['accuracy'] ?? null;
        $quality = $accuracy !== null && $accuracy <= config('telematics.geofence_max_accuracy_meters')
            && $capturedAt->greaterThanOrEqualTo(now()->subSeconds(config('telematics.geofence_max_age_seconds')))
            && $capturedAt->lessThanOrEqualTo(now()->addSeconds(config('telematics.setup_gps_future_skew_seconds')));

        foreach ($trip->booking->bookingGeofences()->whereNotNull('frozen_at')->get() as $zone) {
            $state = $trip->geofenceStates()->firstOrCreate(['booking_geofence_id' => $zone->id]);
            if ($state->last_captured_at && $capturedAt->lessThanOrEqualTo($state->last_captured_at)) {
                continue;
            }
            $state->last_captured_at = $capturedAt;
            $result = app(GeofenceGeometryService::class)->evaluate($zone, (float) $data['latitude'], (float) $data['longitude']);
            if (! $quality || $result['boundary_distance_meters'] <= (float) $accuracy + config('telematics.geofence_boundary_buffer_meters')) {
                $state->fill(['uncertain' => true, 'candidate_inside' => null, 'candidate_count' => 0, 'candidate_started_at' => null])->save();

                continue;
            }
            $inside = $result['inside'];
            $state->uncertain = false;
            if ($state->inside === null || $state->inside === $inside) {
                if ($state->inside === null && $inside && $zone->notify_on_enter) {
                    app(NotificationService::class)->createForTelematicsParticipants(
                        $trip->booking, 'Inside zone', 'Inside '.$zone->name_snapshot.'.', [
                            'action' => 'view_telematics_activity', 'action_label' => 'View activity',
                            'event_type' => 'geofence_initial_inside',
                            'booking_geofence_id' => $zone->id, 'zone_name' => $zone->name_snapshot,
                            'occurred_at' => $capturedAt->toISOString(),
                        ]);
                }
                $state->fill(['inside' => $inside, 'candidate_inside' => null, 'candidate_count' => 0, 'candidate_started_at' => null])->save();

                continue;
            }
            if ($state->candidate_inside !== $inside) {
                $state->fill(['candidate_inside' => $inside, 'candidate_count' => 1, 'candidate_started_at' => $capturedAt]);
            } else {
                $state->candidate_count++;
            }
            $duration = $state->candidate_started_at->diffInSeconds($capturedAt);
            if ($state->candidate_count >= config('telematics.geofence_confirmation_points') && $duration >= config('telematics.geofence_confirmation_seconds')) {
                $type = $inside ? TelematicsEventType::GeofenceEnter : TelematicsEventType::GeofenceExit;
                $event = TelematicsEvent::create([
                    'trip_id' => $trip->id, 'event_type' => $type, 'severity' => 'low', 'occurred_at' => $capturedAt,
                    'metadata' => [
                        'source' => 'server', 'booking_geofence_id' => $zone->id, 'zone_name' => $zone->name_snapshot,
                        'scope' => $zone->scope, 'notification_requested' => $inside ? $zone->notify_on_enter : $zone->notify_on_exit,
                    ],
                ]);
                if ($event->metadata['notification_requested']) {
                    app(NotificationService::class)->createForTelematicsParticipants(
                        $trip->booking, $inside ? 'Zone entered' : 'Zone exited',
                        ($inside ? 'Entered ' : 'Exited ').$zone->name_snapshot.'.', [
                            'action' => 'view_telematics_activity', 'action_label' => 'View activity',
                            'event_type' => $type->value, 'event_id' => $event->id,
                            'booking_geofence_id' => $zone->id, 'zone_name' => $zone->name_snapshot,
                            'occurred_at' => $capturedAt->toISOString(),
                        ]);
                }
                // Website activity is persisted even when this direction's alert is disabled.
                $state->fill(['inside' => $inside, 'candidate_inside' => null, 'candidate_count' => 0, 'candidate_started_at' => null]);
            }
            $state->save();
        }
    }
}
