<?php

namespace App\Http\Resources;

use App\Enums\BookingStatus;
use App\Enums\TelematicsSetupStatus;
use App\Enums\TelematicsSetupStepStatus;
use App\Enums\TelematicsSetupStepType;
use App\Models\Booking;
use App\Models\TelematicsSetupStep;
use App\Services\TelematicsHandoverEligibilityService;
use App\Services\TelematicsSetupService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Booking */
class TelematicsHandoverResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $this->resource->loadMissing([
            'bookingGeofence',
            'telematicsSetupSession.bookingGeofence',
            'telematicsSetupSession.steps',
            'telematicsTrips',
        ]);

        $session = $this->telematicsSetupSession;
        $geofence = $session?->bookingGeofence ?? $this->bookingGeofence;
        $latestSteps = $session?->steps
            ->sortByDesc('attempt_number')
            ->unique('step_type')
            ->keyBy(fn (TelematicsSetupStep $step) => $step->step_type->value) ?? collect();
        $hasActiveTrip = $this->telematicsTrips->contains(fn ($trip) => $trip->status !== 'ended');
        $geofenceAttempt = $latestSteps->get(TelematicsSetupStepType::GeofenceCheck->value);
        $eligibility = app(TelematicsHandoverEligibilityService::class)->evaluate($this->resource);

        return [
            'bookingCode' => $this->booking_code,
            'bookingStatus' => $this->status->value,
            'rentalStartAt' => $this->rental_start_at?->toISOString(),
            'eligibility' => $eligibility,
            'setup' => $session ? [
                'status' => $session->status->value,
                'startedAt' => $session->started_at?->toISOString(),
                'readyAt' => $session->ready_at?->toISOString(),
                'releasedAt' => $session->released_at?->toISOString(),
            ] : null,
            'geofence' => $geofence ? [
                'name' => $geofence->name_snapshot,
                'geometryType' => $geofence->geometry_type,
                'centerLatitude' => $geofence->center_latitude === null ? null : (float) $geofence->center_latitude,
                'centerLongitude' => $geofence->center_longitude === null ? null : (float) $geofence->center_longitude,
                'radiusMeters' => $geofence->radius_meters === null ? null : (float) $geofence->radius_meters,
                'polygonCoordinates' => $geofence->polygon_coordinates,
            ] : null,
            'geofenceCheck' => $geofenceAttempt?->evidence ? [
                'inside' => $geofenceAttempt->evidence['inside'] ?? null,
                'distanceMeters' => $geofenceAttempt->evidence['distance_meters'] ?? null,
                'radiusMeters' => $geofenceAttempt->evidence['radius_meters'] ?? null,
                'geometryType' => $geofenceAttempt->evidence['geometry_type'] ?? null,
                'checkedAt' => $geofenceAttempt->evidence['checked_at'] ?? null,
            ] : null,
            'steps' => collect(TelematicsSetupService::requiredSteps())
                ->map(function (TelematicsSetupStepType $type) use ($latestSteps, $session): array {
                    $step = $latestSteps->get($type->value);

                    return [
                        'type' => $type->value,
                        'label' => self::stepLabel($type),
                        'status' => $step?->status->value ?? TelematicsSetupStepStatus::Pending->value,
                        'attemptCount' => $session?->steps->filter(
                            fn (TelematicsSetupStep $attempt) => $attempt->step_type === $type
                        )->count() ?? 0,
                        'startedAt' => $step?->started_at?->toISOString(),
                        'completedAt' => $step?->completed_at?->toISOString(),
                        'failureReason' => $step?->failure_reason,
                    ];
                })
                ->values()
                ->all(),
            'canBeginSetup' => $session?->status === TelematicsSetupStatus::InProgress,
            'canContinueSetup' => $session?->status === TelematicsSetupStatus::InProgress,
            'canStartTrip' => $session?->status === TelematicsSetupStatus::Released
                && $this->status === BookingStatus::Ongoing
                && ! $hasActiveTrip,
            'tripStatus' => $this->telematicsTrips->sortByDesc('created_at')->first()?->status,
        ];
    }

    private static function stepLabel(TelematicsSetupStepType $type): string
    {
        return match ($type) {
            TelematicsSetupStepType::DeviceCheck => 'Device check',
            TelematicsSetupStepType::MotionPermission => 'Motion permission',
            TelematicsSetupStepType::LocationPermission => 'Location permission',
            TelematicsSetupStepType::BackgroundLocation => 'Background location permission',
            TelematicsSetupStepType::GpsCheck => 'GPS check',
            TelematicsSetupStepType::GeofenceCheck => 'Geofence check',
            TelematicsSetupStepType::PhoneMount => 'Phone mount check',
            TelematicsSetupStepType::StationaryCalibration => 'Stationary calibration',
            TelematicsSetupStepType::ForwardCalibration => 'Forward calibration',
            TelematicsSetupStepType::BrakingCalibration => 'Braking calibration',
            TelematicsSetupStepType::LeftTurnCalibration => 'Left-turn calibration',
            TelematicsSetupStepType::RightTurnCalibration => 'Right-turn calibration',
        };
    }
}
