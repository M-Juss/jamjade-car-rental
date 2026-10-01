<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Enums\TelematicsSetupStatus;
use App\Enums\TelematicsSetupStepStatus;
use App\Enums\TelematicsSetupStepType;
use App\Enums\VehicleInspectionSignerType;
use App\Enums\VehicleInspectionStatus;
use App\Enums\VehicleInspectionType;
use App\Models\Booking;
use App\Models\BookingGeofence;
use App\Models\Geofence;
use App\Models\TelematicsSetupSession;
use App\Models\TelematicsSetupStep;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class TelematicsSetupService
{
    /** @var list<TelematicsSetupStepType> */
    private const MOBILE_IMPLEMENTED_STEPS = [
        TelematicsSetupStepType::DeviceCheck,
        TelematicsSetupStepType::MotionPermission,
        TelematicsSetupStepType::LocationPermission,
        TelematicsSetupStepType::BackgroundLocation,
        TelematicsSetupStepType::GpsCheck,
        TelematicsSetupStepType::GeofenceCheck,
        TelematicsSetupStepType::PhoneMount,
    ];

    /** @return list<TelematicsSetupStepType> */
    public static function requiredSteps(): array
    {
        return TelematicsSetupStepType::cases();
    }

    public function __construct(private readonly TelematicsHandoverEligibilityService $eligibility) {}

    public function enableForFinalizedOutgoing(Booking $booking): ?TelematicsSetupSession
    {
        if ($booking->rental_type !== RentalType::SelfDrive) {
            return null;
        }

        return DB::transaction(function () use ($booking) {
            $booking = Booking::query()->lockForUpdate()->findOrFail($booking->id);
            $session = $booking->telematicsSetupSession()->firstOrCreate([], [
                'booking_geofence_id' => $booking->bookingGeofence?->id,
                'status' => TelematicsSetupStatus::Locked,
            ]);

            if ($session->status === TelematicsSetupStatus::Locked) {
                $session->update([
                    'booking_geofence_id' => $booking->bookingGeofence?->id,
                    'status' => TelematicsSetupStatus::SetupRequired,
                ]);
            }

            return $session->fresh(['bookingGeofence', 'steps']);
        });
    }

    public function assignGeofenceSnapshot(
        Booking $booking,
        ?Geofence $sourceGeofence,
        array $definition,
        ?User $actor = null
    ): BookingGeofence {
        return DB::transaction(function () use ($booking, $sourceGeofence, $definition, $actor) {
            $booking = Booking::query()->lockForUpdate()->findOrFail($booking->id);
            $this->assertSelfDrive($booking);

            if ($booking->status->isTerminal()) {
                throw ValidationException::withMessages([
                    'booking' => ['A finalized booking is view only.'],
                ]);
            }

            if ($sourceGeofence) {
                $sourceGeofence = Geofence::query()->lockForUpdate()->findOrFail($sourceGeofence->id);
                if (! $sourceGeofence->is_active) {
                    throw ValidationException::withMessages(['geofence' => ['Only active geofence templates may be assigned.']]);
                }
            }
            if ($booking->bookingGeofence()->exists()) {
                throw ValidationException::withMessages(['geofence' => ['The booking geofence snapshot is immutable once assigned.']]);
            }

            $values = [
                'name_snapshot' => $definition['name'] ?? $sourceGeofence?->name,
                'geometry_type' => $definition['geometry_type'] ?? $sourceGeofence?->geometry_type ?? 'circle',
                'center_latitude' => $definition['center_latitude'] ?? $sourceGeofence?->center_latitude,
                'center_longitude' => $definition['center_longitude'] ?? $sourceGeofence?->center_longitude,
                'radius_meters' => $definition['radius_meters'] ?? $sourceGeofence?->radius_meters,
                'polygon_coordinates' => $definition['polygon_coordinates'] ?? $sourceGeofence?->polygon_coordinates,
            ];
            app(GeofenceGeometryService::class)->assertValid($values);

            $snapshot = $booking->bookingGeofence()->create([
                'source_geofence_id' => $sourceGeofence?->id,
                ...$values,
                'assigned_by' => $actor?->id,
                'assigned_at' => now(),
            ]);

            $session = $booking->telematicsSetupSession()->firstOrCreate([], [
                'status' => TelematicsSetupStatus::Locked,
            ]);
            $session->update(['booking_geofence_id' => $snapshot->id]);

            return $snapshot;
        });
    }

    public function startHandover(Booking $booking, User $actor): TelematicsSetupSession
    {
        return DB::transaction(function () use ($booking, $actor) {
            $booking = Booking::query()->lockForUpdate()->findOrFail($booking->id);
            $this->assertSelfDrive($booking);

            if ($booking->status !== BookingStatus::Confirmed) {
                throw ValidationException::withMessages([
                    'telematics_setup' => ['Telematics handover is available only for confirmed bookings.'],
                ]);
            }

            $this->eligibility->assertCanStartHandover($booking);

            $session = $booking->telematicsSetupSession()->lockForUpdate()->first();
            if (! $session || $session->status !== TelematicsSetupStatus::SetupRequired) {
                throw ValidationException::withMessages([
                    'telematics_setup' => ['Telematics handover must be in the setup-required state before it can start.'],
                ]);
            }

            $geofence = $booking->bookingGeofence()->first();
            if (! $geofence || (int) $session->booking_geofence_id !== (int) $geofence->id) {
                throw ValidationException::withMessages([
                    'telematics_setup' => ['Assign an immutable booking geofence before starting telematics handover.'],
                ]);
            }

            $booking->load('vehicleInspections.signatures');
            if (! $this->hasFinalizedOutgoingSignatures($booking)) {
                throw ValidationException::withMessages([
                    'telematics_setup' => ['Finalize the Outgoing Inspection with personnel and renter signatures before starting telematics handover.'],
                ]);
            }

            $session->update([
                'status' => TelematicsSetupStatus::InProgress,
                'started_at' => $session->started_at ?? now(),
            ]);

            activity()
                ->causedBy($actor)
                ->performedOn($booking)
                ->event('telematics_handover_started')
                ->withProperties(['telematics_setup_session_id' => $session->id])
                ->log('Staff started the telematics handover.');

            return $session->fresh(['bookingGeofence', 'steps']);
        });
    }

    public function recordStep(
        TelematicsSetupSession $session,
        TelematicsSetupStepType $type,
        TelematicsSetupStepStatus $status,
        ?array $evidence = null,
        ?string $failureReason = null,
        ?User $actor = null
    ): TelematicsSetupStep {
        return DB::transaction(function () use ($session, $type, $status, $evidence, $failureReason, $actor) {
            $session = TelematicsSetupSession::query()->lockForUpdate()->findOrFail($session->id);
            $this->assertSessionCanBeWorked($session);

            $attempt = (int) $session->steps()
                ->where('step_type', $type->value)
                ->max('attempt_number') + 1;
            $now = now();
            $step = $session->steps()->create([
                'step_type' => $type,
                'attempt_number' => $attempt,
                'status' => $status,
                'started_at' => $now,
                'completed_at' => in_array($status, [TelematicsSetupStepStatus::Passed, TelematicsSetupStepStatus::Failed], true) ? $now : null,
                'failure_reason' => $failureReason,
                'evidence' => $evidence,
                'actor_user_id' => $actor?->id,
            ]);

            $this->refreshReadiness($session);

            return $step->fresh('session');
        });
    }

    public function recordMobileAttempt(Booking $booking, string $step, array $evidence, User $actor): TelematicsSetupStep
    {
        $type = TelematicsSetupStepType::tryFrom($step);
        if (! $type || ! in_array($type, self::MOBILE_IMPLEMENTED_STEPS, true)) {
            throw ValidationException::withMessages(['step' => ['This telematics setup step is not available in the current phase.']]);
        }

        return DB::transaction(function () use ($booking, $type, $evidence, $actor) {
            $booking = Booking::query()->lockForUpdate()->findOrFail($booking->id);
            $this->assertSelfDrive($booking);
            if ((int) $booking->user_id !== (int) $actor->id) {
                throw ValidationException::withMessages(['booking' => ['You may only submit setup checks for your own booking.']]);
            }
            $this->eligibility->assertCanWorkSetup($booking);
            $session = $booking->telematicsSetupSession()->lockForUpdate()->first();
            if (! $session) {
                throw ValidationException::withMessages(['telematics_setup' => ['A telematics handover session is required.']]);
            }
            $this->assertSessionCanBeWorked($session);
            $session->load('steps');
            $this->assertPrerequisites($session, $type);

            [$status, $sanitizedEvidence, $failureReason] = $this->evaluateMobileEvidence($session, $type, $evidence);

            $attempt = $this->recordStep($session, $type, $status, $sanitizedEvidence, $failureReason, $actor);

            activity()
                ->causedBy($actor)
                ->performedOn($booking)
                ->event('telematics_setup_step_attempted')
                ->withProperties([
                    'step_type' => $type->value,
                    'result' => $status->value,
                ])
                ->log('Telematics setup step evaluated.');

            return $attempt;
        });
    }

    public function assertReadyForRelease(Booking $booking): void
    {
        if ($booking->rental_type !== RentalType::SelfDrive) {
            return;
        }

        $session = $booking->telematicsSetupSession;
        if (! $session || $session->status !== TelematicsSetupStatus::ReadyForRelease || ! $this->isReady($session)) {
            throw ValidationException::withMessages([
                'telematics_setup' => ['Complete all required telematics setup checks before starting this self-drive rental.'],
            ]);
        }
    }

    public function markReleased(Booking $booking): void
    {
        if ($booking->rental_type !== RentalType::SelfDrive) {
            return;
        }

        $session = $booking->telematicsSetupSession()->lockForUpdate()->first();
        if (! $session || $session->status !== TelematicsSetupStatus::ReadyForRelease || ! $this->isReady($session)) {
            throw ValidationException::withMessages([
                'telematics_setup' => ['A ready telematics setup session is required before release.'],
            ]);
        }

        $session->update([
            'status' => TelematicsSetupStatus::Released,
            'released_at' => now(),
        ]);
    }

    public function isReady(TelematicsSetupSession $session): bool
    {
        $session->loadMissing(['booking.bookingGeofence', 'booking.vehicleInspections.signatures', 'steps']);
        $booking = $session->booking;
        if (! $booking || $booking->rental_type !== RentalType::SelfDrive || ! $session->booking_geofence_id) {
            return false;
        }

        if (! $this->hasFinalizedOutgoingSignatures($booking)) {
            return false;
        }

        $latestByType = $session->steps
            ->sortByDesc('attempt_number')
            ->unique('step_type')
            ->keyBy(fn (TelematicsSetupStep $step) => $step->step_type->value);

        return collect(self::requiredSteps())->every(
            fn (TelematicsSetupStepType $type) => $latestByType->get($type->value)?->status === TelematicsSetupStepStatus::Passed
        );
    }

    private function refreshReadiness(TelematicsSetupSession $session): void
    {
        $session->load(['booking.vehicleInspections.signatures', 'steps']);
        $ready = $this->isReady($session);
        $session->update([
            'status' => $ready ? TelematicsSetupStatus::ReadyForRelease : TelematicsSetupStatus::InProgress,
            'started_at' => $session->started_at ?? now(),
            'ready_at' => $ready ? ($session->ready_at ?? now()) : null,
        ]);
    }

    private function assertPrerequisites(TelematicsSetupSession $session, TelematicsSetupStepType $type): void
    {
        $required = match ($type) {
            TelematicsSetupStepType::DeviceCheck => [],
            TelematicsSetupStepType::MotionPermission => [TelematicsSetupStepType::DeviceCheck],
            TelematicsSetupStepType::LocationPermission => [TelematicsSetupStepType::DeviceCheck, TelematicsSetupStepType::MotionPermission],
            TelematicsSetupStepType::BackgroundLocation => [TelematicsSetupStepType::LocationPermission],
            TelematicsSetupStepType::GpsCheck => [TelematicsSetupStepType::BackgroundLocation],
            TelematicsSetupStepType::GeofenceCheck => [TelematicsSetupStepType::GpsCheck],
            TelematicsSetupStepType::PhoneMount => [TelematicsSetupStepType::GeofenceCheck],
            default => [],
        };
        $latest = $session->steps->sortByDesc('attempt_number')->unique('step_type')
            ->keyBy(fn (TelematicsSetupStep $attempt) => $attempt->step_type->value);
        $missing = collect($required)->first(
            fn (TelematicsSetupStepType $requiredType) => $latest->get($requiredType->value)?->status !== TelematicsSetupStepStatus::Passed
        );

        if ($missing) {
            throw ValidationException::withMessages([
                'step' => ["Complete {$missing->value} before attempting {$type->value}."],
            ]);
        }
    }

    /** @return array{0: TelematicsSetupStepStatus, 1: array<string, mixed>, 2: ?string} */
    private function evaluateMobileEvidence(TelematicsSetupSession $session, TelematicsSetupStepType $type, array $evidence): array
    {
        return match ($type) {
            TelematicsSetupStepType::DeviceCheck => $this->evaluateDeviceEvidence($evidence),
            TelematicsSetupStepType::MotionPermission => $this->evaluatePermissionEvidence($evidence, 'motion permission'),
            TelematicsSetupStepType::LocationPermission => $this->evaluatePermissionEvidence($evidence, 'foreground location permission'),
            TelematicsSetupStepType::BackgroundLocation => $this->evaluateBackgroundLocationEvidence($evidence),
            TelematicsSetupStepType::GpsCheck => $this->evaluateGpsEvidence($evidence),
            TelematicsSetupStepType::GeofenceCheck => $this->evaluateGeofenceEvidence($session, $evidence),
            TelematicsSetupStepType::PhoneMount => $this->evaluatePhoneMountEvidence($evidence),
            default => throw ValidationException::withMessages(['step' => ['This setup step is not available.']]),
        };
    }

    /** @return array{0: TelematicsSetupStepStatus, 1: array<string, mixed>, 2: ?string} */
    private function evaluateDeviceEvidence(array $evidence): array
    {
        $values = Validator::make($evidence, [
            'accelerometer_available' => ['required', 'boolean'],
            'gyroscope_available' => ['required', 'boolean'],
            'location_services_available' => ['required', 'boolean'],
            'platform' => ['required', 'string', 'max:20'],
            'build_context' => ['required', 'string', 'max:40'],
            'checked_at' => ['required', 'date'],
        ])->validate();
        $passed = $values['accelerometer_available'] && $values['gyroscope_available'] && $values['location_services_available'];

        return [$passed ? TelematicsSetupStepStatus::Passed : TelematicsSetupStepStatus::Failed, $values,
            $passed ? null : 'This device does not currently provide every required sensor or location capability.'];
    }

    /** @return array{0: TelematicsSetupStepStatus, 1: array<string, mixed>, 2: ?string} */
    private function evaluatePermissionEvidence(array $evidence, string $label): array
    {
        $values = Validator::make($evidence, [
            'permission_state' => ['required', 'in:granted,denied,unavailable'],
            'can_ask_again' => ['nullable', 'boolean'],
            'platform' => ['required', 'string', 'max:20'],
            'checked_at' => ['required', 'date'],
        ])->validate();
        $passed = $values['permission_state'] === 'granted';

        return [$passed ? TelematicsSetupStepStatus::Passed : TelematicsSetupStepStatus::Failed, $values,
            $passed ? null : "{$label} is not granted. Review the device settings and try again."];
    }

    /** @return array{0: TelematicsSetupStepStatus, 1: array<string, mixed>, 2: ?string} */
    private function evaluateBackgroundLocationEvidence(array $evidence): array
    {
        $values = Validator::make($evidence, [
            'permission_state' => ['required', 'in:granted,denied,unavailable'],
            'background_location_available' => ['required', 'boolean'],
            'task_manager_available' => ['required', 'boolean'],
            'task_defined' => ['required', 'boolean'],
            'platform' => ['required', 'string', 'max:20'],
            'checked_at' => ['required', 'date'],
        ])->validate();
        $passed = $values['permission_state'] === 'granted'
            && $values['background_location_available']
            && $values['task_manager_available']
            && $values['task_defined'];

        return [$passed ? TelematicsSetupStepStatus::Passed : TelematicsSetupStepStatus::Failed, $values,
            $passed ? null : 'Background location permission or task infrastructure is not ready.'];
    }

    /** @return array{0: TelematicsSetupStepStatus, 1: array<string, mixed>, 2: ?string} */
    private function evaluateGpsEvidence(array $evidence): array
    {
        $values = Validator::make($evidence, [
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy' => ['required', 'numeric', 'min:0', 'max:10000'],
            'speed' => ['nullable', 'numeric', 'min:0', 'max:300'],
            'heading' => ['nullable', 'numeric', 'between:0,360'],
            'captured_at' => ['required', 'date'],
            'location_services_enabled' => ['required', 'boolean'],
        ])->validate();
        $capturedAt = CarbonImmutable::parse($values['captured_at']);
        $now = now();
        $age = $capturedAt->diffInSeconds($now);
        $maxAge = (int) config('telematics.setup_gps_max_age_seconds');
        $maxAccuracy = (float) config('telematics.setup_gps_max_accuracy_meters');
        $futureSkew = (int) config('telematics.setup_gps_future_skew_seconds');
        $failure = null;
        if (! $values['location_services_enabled']) {
            $failure = 'Location services are disabled.';
        } elseif ($capturedAt->greaterThan($now->copy()->addSeconds($futureSkew))) {
            $failure = 'The GPS fix timestamp is not valid.';
        } elseif ($age > $maxAge) {
            $failure = 'The GPS fix is too old. Get a fresh location fix and try again.';
        } elseif ((float) $values['accuracy'] > $maxAccuracy) {
            $failure = 'GPS accuracy is not yet sufficient. Move to a clearer area and try again.';
        }

        // Exact coordinates are used transiently for validation/geofence math and
        // intentionally omitted from the persisted pre-release setup evidence.
        $sanitized = [
            'accuracy_meters' => (float) $values['accuracy'],
            'fix_age_seconds' => $age,
            'checked_at' => $now->toISOString(),
            'location_services_enabled' => (bool) $values['location_services_enabled'],
        ];

        return [$failure ? TelematicsSetupStepStatus::Failed : TelematicsSetupStepStatus::Passed, $sanitized, $failure];
    }

    /** @return array{0: TelematicsSetupStepStatus, 1: array<string, mixed>, 2: ?string} */
    private function evaluateGeofenceEvidence(TelematicsSetupSession $session, array $evidence): array
    {
        [$gpsStatus, $gpsEvidence, $gpsFailure] = $this->evaluateGpsEvidence($evidence);
        if ($gpsStatus === TelematicsSetupStepStatus::Failed) {
            return [$gpsStatus, $gpsEvidence, $gpsFailure];
        }
        $geofence = $session->bookingGeofence()->first();
        if (! $geofence) {
            return [TelematicsSetupStepStatus::Failed, $gpsEvidence, 'No immutable booking geofence is assigned.'];
        }
        $result = app(GeofenceGeometryService::class)->evaluate(
            $geofence,
            (float) $evidence['latitude'],
            (float) $evidence['longitude']
        );
        $sanitized = [...$gpsEvidence, ...$result];

        return [$result['inside'] ? TelematicsSetupStepStatus::Passed : TelematicsSetupStepStatus::Failed, $sanitized,
            $result['inside'] ? null : 'The current GPS fix is outside the assigned rental area.'];
    }

    /** @return array{0: TelematicsSetupStepStatus, 1: array<string, mixed>, 2: ?string} */
    private function evaluatePhoneMountEvidence(array $evidence): array
    {
        $values = Validator::make($evidence, [
            'confirmed' => ['required', 'boolean'],
            'checked_at' => ['required', 'date'],
        ])->validate();

        return [$values['confirmed'] ? TelematicsSetupStepStatus::Passed : TelematicsSetupStepStatus::Failed, $values,
            $values['confirmed'] ? null : 'Confirm that the phone is securely mounted before continuing.'];
    }

    private function assertSessionCanBeWorked(TelematicsSetupSession $session): void
    {
        $session->loadMissing('booking');
        $this->assertSelfDrive($session->booking);
        if ($session->booking->status !== BookingStatus::Confirmed || $session->status !== TelematicsSetupStatus::InProgress) {
            throw ValidationException::withMessages(['telematics_setup' => ['Setup checks are available only after staff starts telematics handover.']]);
        }
        if ($session->status === TelematicsSetupStatus::Released) {
            throw ValidationException::withMessages(['telematics_setup' => ['Released setup sessions cannot be changed.']]);
        }
    }

    private function hasFinalizedOutgoingSignatures(Booking $booking): bool
    {
        $outgoing = $booking->vehicleInspections
            ->first(fn ($inspection) => $inspection->type === VehicleInspectionType::Outgoing
                && $inspection->status === VehicleInspectionStatus::Finalized);

        return (bool) $outgoing
            && $outgoing->signatures->contains('signer_type', VehicleInspectionSignerType::Personnel)
            && $outgoing->signatures->contains('signer_type', VehicleInspectionSignerType::Renter);
    }

    private function assertSelfDrive(?Booking $booking): void
    {
        if (! $booking || $booking->rental_type !== RentalType::SelfDrive) {
            throw ValidationException::withMessages(['telematics_setup' => ['Telematics setup applies only to self-drive bookings.']]);
        }
    }
}
