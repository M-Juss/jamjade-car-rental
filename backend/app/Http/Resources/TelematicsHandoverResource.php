<?php

namespace App\Http\Resources;

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Enums\TelematicsSetupStatus;
use App\Enums\TelematicsSetupStepStatus;
use App\Enums\TelematicsSetupStepType;
use App\Models\Booking;
use App\Models\TelematicsSetupStep;
use App\Services\TelematicsCalibrationService;
use App\Services\TelematicsHandoverEligibilityService;
use App\Services\TelematicsOperatorService;
use App\Services\TelematicsSetupService;
use App\Support\PublicStorageUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Booking */
class TelematicsHandoverResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $this->resource->loadMissing([
            'telematicsSetupSession.steps',
            'telematicsTrips',
            'vehicle.images',
        ]);

        $session = $this->telematicsSetupSession;
        $calibration = app(TelematicsCalibrationService::class);
        $latestSteps = $session ? $calibration->latestSteps($session) : collect();
        $attempts = $session?->currentAttempts() ?? collect();
        if ($this->rental_type === RentalType::OwnersDriver) {
            $operatorId = app(TelematicsOperatorService::class)->operatorId($this->resource);
            $attempts = $attempts->filter(fn (TelematicsSetupStep $step) => (int) $step->actor_user_id === (int) $operatorId);
        }
        $hasTrip = $this->telematicsTrips->isNotEmpty();
        $eligibility = app(TelematicsHandoverEligibilityService::class)->evaluate($this->resource);

        return [
            'bookingCode' => $this->booking_code,
            'bookingStatus' => $this->status->value,
            'rentalStartAt' => $this->rental_start_at?->toISOString(),
            'rentalEndAt' => $this->rental_end_at?->toISOString(),
            'vehicle' => [
                'name' => collect([$this->vehicle?->brand, $this->vehicle?->name, $this->vehicle?->model])->filter()->join(' '),
                'image' => PublicStorageUrl::make($this->vehicle?->images->first()?->image_path),
                'secondaryImage' => PublicStorageUrl::make($this->vehicle?->images->get(1)?->image_path ?? $this->vehicle?->images->first()?->image_path),
            ],
            'eligibility' => $eligibility,
            'calibration' => $calibration->projection($session),
            'setup' => $session ? [
                'status' => $eligibility['setupStatus'],
                'startedAt' => $session->started_at?->toISOString(),
                'readyAt' => $eligibility['setupStatus'] === $session->status->value ? $session->ready_at?->toISOString() : null,
                'releasedAt' => $session->released_at?->toISOString(),
                'canRestart' => $eligibility['setupStatus'] === TelematicsSetupStatus::ReadyForRelease->value
                    && $eligibility['bookingConfirmed'] && $eligibility['setupTimeEligible']
                    && $eligibility['customerSelfDriveAvailable'] && $eligibility['operatorEligible']
                    && ($eligibility['testMode'] || $eligibility['documentsVerified'])
                    && collect(TelematicsSetupService::requiredSteps())->every(
                        fn (TelematicsSetupStepType $type) => $latestSteps->get($type->value)?->status === TelematicsSetupStepStatus::Passed
                    ),
            ] : null,
            'steps' => collect(TelematicsSetupService::displayedSteps($session))
                ->map(function (TelematicsSetupStepType $type) use ($latestSteps, $attempts): array {
                    $step = $latestSteps->get($type->value);

                    return [
                        'type' => $type->value,
                        'label' => self::stepLabel($type),
                        'status' => $step?->status->value ?? TelematicsSetupStepStatus::Pending->value,
                        'attemptCount' => $attempts->where('step_type', $type)->count(),
                        'startedAt' => $step?->started_at?->toISOString(),
                        'completedAt' => $step?->completed_at?->toISOString(),
                        'failureReason' => $step?->failure_reason,
                    ];
                })
                ->values()
                ->all(),
            'canBeginSetup' => $eligibility['canWorkSetup'],
            'canContinueSetup' => $eligibility['canWorkSetup'],
            'canStartTrip' => $session?->status === TelematicsSetupStatus::Released
                && $this->status === BookingStatus::Ongoing
                && ! $hasTrip,
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
            TelematicsSetupStepType::PhoneMount => 'Phone mount check',
            TelematicsSetupStepType::StationaryCalibration => 'Stationary calibration',
            TelematicsSetupStepType::ForwardCalibration => 'Forward calibration',
            TelematicsSetupStepType::BrakingCalibration => 'Braking calibration',
            TelematicsSetupStepType::LeftTurnCalibration => 'Left-turn calibration',
            TelematicsSetupStepType::RightTurnCalibration => 'Right-turn calibration',
        };
    }
}
