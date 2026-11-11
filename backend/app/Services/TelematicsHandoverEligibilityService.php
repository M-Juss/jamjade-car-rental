<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\DocumentStatus;
use App\Enums\RentalType;
use App\Enums\TelematicsSetupStatus;
use App\Enums\VehicleInspectionSignerType;
use App\Enums\VehicleInspectionStatus;
use App\Enums\VehicleInspectionType;
use App\Models\Booking;
use App\Models\CustomerDocument;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Validation\ValidationException;

class TelematicsHandoverEligibilityService
{
    private const BUSINESS_TIMEZONE = 'Asia/Manila';

    public function testModeEnabled(): bool
    {
        return app()->environment(['local', 'testing'])
            && (bool) config('telematics.handover_test_mode', false);
    }

    public function earlyStartTestModeEnabled(): bool
    {
        return app()->environment(['local', 'testing'])
            && (bool) config('telematics.early_start_test_mode', false);
    }

    public function currentBookingFor(User $user): ?Booking
    {
        return $this->rentalsQuery($user)->first();
    }

    public function paginateRentalsFor(User $user, int $perPage): LengthAwarePaginator
    {
        return $this->rentalsQuery($user)->select([
            'bookings.id', 'bookings.booking_code', 'bookings.user_id', 'bookings.vehicle_id',
            'bookings.status', 'bookings.rental_type', 'bookings.rental_start_at', 'bookings.rental_end_at',
        ])->with([
            'vehicle:id,name,brand,model',
            'vehicle.images:id,vehicle_id,image_path',
            'assignedDriver:users.id,name,is_active',
            'assignment:id,booking_id,driver_id',
            'user:id',
            'user.documents:id,user_id,document_type,status',
            'telematicsSetupSession:id,booking_id,status',
            'telematicsSetupSession.latestStationary',
            'vehicleInspections:id,booking_id,type,status',
            'vehicleInspections.signatures:id,inspection_id,signer_type',
        ])->withExists(['telematicsSetupSession as has_setup_attempts' => fn ($query) => $query->whereHas('steps',
            fn ($steps) => $steps->whereColumn('telematics_setup_steps.id', '>', 'telematics_setup_sessions.reset_through_step_id'))])
            ->paginate($perPage);
    }

    private function rentalsQuery(User $user): Builder
    {
        return Booking::query()
            ->leftJoin('telematics_setup_sessions', 'telematics_setup_sessions.booking_id', '=', 'bookings.id')
            ->select('bookings.*')
            ->where(function (Builder $query) use ($user) {
                if ($user->hasRole('customer')) {
                    $query->where(fn (Builder $nested) => $nested
                        ->where('bookings.user_id', $user->id)
                        ->where('bookings.rental_type', RentalType::SelfDrive->value));
                }
                if ($user->hasRole(DriverAssignmentService::DRIVER_ROLE)) {
                    $query->orWhere(fn (Builder $nested) => $nested
                        ->where('bookings.rental_type', RentalType::OwnersDriver->value)
                        ->whereHas('assignment', fn (Builder $assignment) => $assignment->where('driver_id', $user->id)));
                }
                if (! $user->hasRole('customer') && ! $user->hasRole(DriverAssignmentService::DRIVER_ROLE)) {
                    $query->whereRaw('1 = 0');
                }
            })
            ->whereIn('bookings.status', [
                BookingStatus::Ongoing->value,
                BookingStatus::Confirmed->value,
                BookingStatus::Pending->value,
            ])
            ->orderByRaw(
                'case
                    when bookings.status = ? then 0
                    when bookings.status = ? and telematics_setup_sessions.status = ? then 1
                    when bookings.status = ? then 2
                    else 3
                end',
                [
                    BookingStatus::Ongoing->value,
                    BookingStatus::Confirmed->value,
                    TelematicsSetupStatus::InProgress->value,
                    BookingStatus::Confirmed->value,
                ]
            )
            ->orderBy('bookings.rental_start_at')
            ->orderBy('bookings.id');
    }

    /** @return array<string, bool|string|null> */
    public function evaluate(Booking $booking, ?bool $customerAvailable = null): array
    {
        $booking->loadMissing([
            'user.documents',
            'telematicsSetupSession',
            'vehicleInspections.signatures',
        ]);

        $testMode = $this->testModeEnabled();
        $operatorService = app(TelematicsOperatorService::class);
        $supported = $operatorService->supports($booking);
        $selfDrive = $booking->rental_type === RentalType::SelfDrive;
        $documentsVerified = ! $selfDrive || $this->documentsVerified($booking);
        $operatorAssigned = $selfDrive || $booking->assignedDriver !== null;
        $operatorEligible = $selfDrive || ($booking->assignedDriver
            && $booking->assignedDriver->is_active
            && $booking->assignedDriver->hasRole(DriverAssignmentService::DRIVER_ROLE));
        $bookingConfirmed = $booking->status === BookingStatus::Confirmed;
        $rentalPeriodEligible = $bookingConfirmed && $this->isRentalTimeEligible($booking);
        $outgoingInspectionComplete = $this->hasFinalizedOutgoingSignatures($booking, $operatorService->inspectionSigner($booking));
        $setupStatus = app(TelematicsCalibrationService::class)->effectiveStatus($booking->telematicsSetupSession)?->value;
        $handoverStarted = $setupStatus === TelematicsSetupStatus::InProgress->value;
        $released = $booking->status === BookingStatus::Ongoing && $setupStatus === TelematicsSetupStatus::Released->value;
        $customerAvailable ??= ! $selfDrive || app(SelfDriveBookingAvailabilityService::class)->canHandover($booking);

        return [
            'testMode' => $testMode && $selfDrive,
            'hasSelfDriveBooking' => $selfDrive,
            'supportedRental' => $supported,
            'operatorAssigned' => (bool) $operatorAssigned,
            'operatorEligible' => (bool) $operatorEligible,
            'documentsVerified' => $documentsVerified,
            'bookingConfirmed' => $bookingConfirmed,
            'rentalPeriodEligible' => $rentalPeriodEligible,
            'outgoingInspectionComplete' => $outgoingInspectionComplete,
            'handoverStarted' => $handoverStarted,
            'customerSelfDriveAvailable' => $customerAvailable,
            'setupStatus' => $setupStatus,
            'canViewTelematics' => $supported,
            'canStartHandover' => $supported && $bookingConfirmed && $rentalPeriodEligible && $customerAvailable && $operatorEligible && ($testMode && $selfDrive
                ? in_array($setupStatus, [null, TelematicsSetupStatus::Locked->value, TelematicsSetupStatus::SetupRequired->value], true)
                : $documentsVerified && $outgoingInspectionComplete
                    && $setupStatus === TelematicsSetupStatus::SetupRequired->value),
            'canWorkSetup' => $supported && $bookingConfirmed && $rentalPeriodEligible && $customerAvailable && $operatorEligible
                && ($testMode && $selfDrive || $documentsVerified)
                && ($handoverStarted || ($testMode && $selfDrive && $setupStatus === TelematicsSetupStatus::ReadyForRelease->value)),
            'state' => in_array($booking->status, [BookingStatus::Returned, BookingStatus::Completed], true) ? 'rental_ended' : (! $released && ! $customerAvailable ? 'other_rental_active' : ($testMode && $selfDrive && $bookingConfirmed
                ? match (true) {
                    ! $rentalPeriodEligible => 'rental_scheduled',
                    $handoverStarted || $setupStatus === TelematicsSetupStatus::ReadyForRelease->value => 'handover_in_progress',
                    default => 'handover_preparation',
                }
                : $this->state($booking, $documentsVerified, $rentalPeriodEligible, $outgoingInspectionComplete, $handoverStarted, $released))),
        ];
    }

    public function assertCanStartHandover(Booking $booking): void
    {
        app(SelfDriveBookingAvailabilityService::class)->assertHandoverAvailable($booking);
        $eligibility = $this->evaluate($booking);
        $testSelfDrive = $this->testModeEnabled() && $booking->rental_type === RentalType::SelfDrive;
        $required = $testSelfDrive
            ? ['rentalPeriodEligible']
            : ['operatorAssigned', 'operatorEligible', 'documentsVerified', 'rentalPeriodEligible', 'outgoingInspectionComplete'];
        $missing = collect($required)->filter(fn (string $key) => ! $eligibility[$key])->values()->all();

        if ($missing !== []) {
            throw ValidationException::withMessages([
                'telematics_setup' => [$testSelfDrive
                    ? 'Test handover requires today to be the rental start date in Asia/Manila or time within the reserved interval, before the rental ends.'
                    : 'Telematics handover cannot start until verification, the reserved rental interval and inspection signatures are ready.'],
                'requirements' => $missing,
            ]);
        }
    }

    public function assertCanWorkSetup(Booking $booking): void
    {
        app(SelfDriveBookingAvailabilityService::class)->assertHandoverAvailable($booking);
        $eligibility = $this->evaluate($booking);

        $testSelfDrive = $this->testModeEnabled() && $booking->rental_type === RentalType::SelfDrive;
        if (! $eligibility['rentalPeriodEligible'] || ! $eligibility['operatorEligible'] || (! $testSelfDrive && ! $eligibility['documentsVerified'])) {
            throw ValidationException::withMessages([
                'telematics_setup' => [$testSelfDrive
                    ? 'Test setup requires today to be the rental start date in Asia/Manila or time within the reserved interval, before the rental ends.'
                    : 'Telematics setup requires approved self-drive documents and an eligible scheduled rental time.'],
            ]);
        }
    }

    private function documentsVerified(Booking $booking): bool
    {
        $required = CustomerDocument::requiredSelfDriveDocumentsFor($booking->user);

        return $booking->user->documents->whereIn('document_type', $required)
            ->filter(fn (CustomerDocument $document) => $document->status === DocumentStatus::Approved)
            ->count() === count($required);
    }

    public function isRentalTimeEligible(Booking $booking): bool
    {
        if (! $booking->rental_start_at || ! $booking->rental_end_at) {
            return false;
        }

        $now = CarbonImmutable::now(self::BUSINESS_TIMEZONE);
        $rentalStart = CarbonImmutable::instance($booking->rental_start_at)->setTimezone(self::BUSINESS_TIMEZONE);

        if ($now->gte($booking->rental_end_at)) {
            return false;
        }

        return $now->gte($rentalStart)
            || (($this->earlyStartTestModeEnabled() || $this->testModeEnabled()) && $now->isSameDay($rentalStart));
    }

    private function hasFinalizedOutgoingSignatures(Booking $booking, VehicleInspectionSignerType $operatorSigner): bool
    {
        $outgoing = $booking->vehicleInspections->first(fn ($inspection) => $inspection->type === VehicleInspectionType::Outgoing
            && $inspection->status === VehicleInspectionStatus::Finalized);

        return (bool) $outgoing
            && $outgoing->signatures->contains('signer_type', VehicleInspectionSignerType::Personnel)
            && $outgoing->signatures->contains('signer_type', $operatorSigner);
    }

    private function state(Booking $booking, bool $documentsVerified, bool $rentalPeriodEligible, bool $outgoingInspectionComplete, bool $handoverStarted, bool $released): string
    {
        return match (true) {
            $released => 'released',
            ! $documentsVerified => 'verification_required',
            $booking->status !== BookingStatus::Confirmed => 'waiting_for_confirmation',
            ! $rentalPeriodEligible => 'rental_scheduled',
            ! $outgoingInspectionComplete => 'inspection_required',
            ! $handoverStarted => 'handover_preparation',
            default => 'handover_in_progress',
        };
    }
}
