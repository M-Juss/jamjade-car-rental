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
use Illuminate\Validation\ValidationException;

class TelematicsHandoverEligibilityService
{
    private const BUSINESS_TIMEZONE = 'Asia/Manila';

    public function currentBookingFor(User $user): ?Booking
    {
        return Booking::query()
            ->leftJoin('telematics_setup_sessions', 'telematics_setup_sessions.booking_id', '=', 'bookings.id')
            ->select('bookings.*')
            ->where('bookings.user_id', $user->id)
            ->where('bookings.rental_type', RentalType::SelfDrive->value)
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
            ->first();
    }

    /** @return array<string, bool|string|null> */
    public function evaluate(Booking $booking): array
    {
        $booking->loadMissing([
            'user.documents',
            'bookingGeofence',
            'telematicsSetupSession',
            'vehicleInspections.signatures',
        ]);

        $selfDrive = $booking->rental_type === RentalType::SelfDrive;
        $documentsVerified = $selfDrive && $this->documentsVerified($booking);
        $bookingConfirmed = $booking->status === BookingStatus::Confirmed;
        $rentalPeriodEligible = $bookingConfirmed && $this->isAtOrAfterRentalStart($booking);
        $outgoingInspectionComplete = $this->hasFinalizedOutgoingSignatures($booking);
        $geofenceAssigned = $booking->bookingGeofence !== null
            && (int) ($booking->telematicsSetupSession?->booking_geofence_id ?? 0) === (int) $booking->bookingGeofence->id;
        $setupStatus = $booking->telematicsSetupSession?->status?->value;
        $handoverStarted = $setupStatus === TelematicsSetupStatus::InProgress->value;
        $released = $booking->status === BookingStatus::Ongoing && $setupStatus === TelematicsSetupStatus::Released->value;

        return [
            'hasSelfDriveBooking' => $selfDrive,
            'documentsVerified' => $documentsVerified,
            'bookingConfirmed' => $bookingConfirmed,
            'rentalPeriodEligible' => $rentalPeriodEligible,
            'outgoingInspectionComplete' => $outgoingInspectionComplete,
            'geofenceAssigned' => $geofenceAssigned,
            'handoverStarted' => $handoverStarted,
            'setupStatus' => $setupStatus,
            'canViewTelematics' => $selfDrive,
            'canStartHandover' => $documentsVerified && $rentalPeriodEligible && $outgoingInspectionComplete && $geofenceAssigned
                && $setupStatus === TelematicsSetupStatus::SetupRequired->value,
            'canWorkSetup' => $documentsVerified && $rentalPeriodEligible && $bookingConfirmed && $handoverStarted,
            'state' => $this->state($booking, $documentsVerified, $rentalPeriodEligible, $outgoingInspectionComplete, $geofenceAssigned, $handoverStarted, $released),
        ];
    }

    public function assertCanStartHandover(Booking $booking): void
    {
        $eligibility = $this->evaluate($booking);
        $missing = collect([
            'documentsVerified',
            'rentalPeriodEligible',
            'outgoingInspectionComplete',
            'geofenceAssigned',
        ])->filter(fn (string $key) => ! $eligibility[$key])->values()->all();

        if ($missing !== []) {
            throw ValidationException::withMessages([
                'telematics_setup' => ['Telematics handover cannot start until verification, the scheduled rental time, inspection signatures, and booking geofence are ready.'],
                'requirements' => $missing,
            ]);
        }
    }

    public function assertCanWorkSetup(Booking $booking): void
    {
        $eligibility = $this->evaluate($booking);

        if (! $eligibility['documentsVerified'] || ! $eligibility['rentalPeriodEligible']) {
            throw ValidationException::withMessages([
                'telematics_setup' => ['Telematics setup requires approved self-drive documents and an eligible scheduled rental time.'],
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

    private function isAtOrAfterRentalStart(Booking $booking): bool
    {
        if (! $booking->rental_start_at) {
            return false;
        }

        $now = CarbonImmutable::now(self::BUSINESS_TIMEZONE);
        $rentalStart = CarbonImmutable::instance($booking->rental_start_at)->setTimezone(self::BUSINESS_TIMEZONE);

        return $now->toDateString() === $rentalStart->toDateString();
    }

    private function hasFinalizedOutgoingSignatures(Booking $booking): bool
    {
        $outgoing = $booking->vehicleInspections->first(fn ($inspection) => $inspection->type === VehicleInspectionType::Outgoing
            && $inspection->status === VehicleInspectionStatus::Finalized);

        return (bool) $outgoing
            && $outgoing->signatures->contains('signer_type', VehicleInspectionSignerType::Personnel)
            && $outgoing->signatures->contains('signer_type', VehicleInspectionSignerType::Renter);
    }

    private function state(Booking $booking, bool $documentsVerified, bool $rentalPeriodEligible, bool $outgoingInspectionComplete, bool $geofenceAssigned, bool $handoverStarted, bool $released): string
    {
        return match (true) {
            $released => 'released',
            ! $documentsVerified => 'verification_required',
            $booking->status !== BookingStatus::Confirmed => 'waiting_for_confirmation',
            ! $rentalPeriodEligible => 'rental_scheduled',
            ! $outgoingInspectionComplete => 'inspection_required',
            ! $geofenceAssigned || ! $handoverStarted => 'handover_preparation',
            default => 'handover_in_progress',
        };
    }
}
