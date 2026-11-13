<?php

namespace App\Services;

use App\Enums\AdditionalChargeResponsibility;
use App\Enums\BookingStatus;
use App\Enums\DocumentStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Enums\TelematicsSetupStatus;
use App\Enums\VehicleStatus;
use App\Models\Booking;
use App\Models\CustomerDocument;
use App\Support\CustomerAgePolicy;
use Illuminate\Validation\ValidationException;

class RentalReadinessService
{
    public function __construct(
        private readonly DriverAssignmentService $drivers,
        private readonly AdditionalChargeService $charges,
        private readonly VehicleAvailabilityService $availability,
        private readonly TelematicsSetupService $telematicsSetup
    ) {}

    public function evaluate(Booking $booking): array
    {
        $booking->loadMissing([
            'user.customerProfile', 'user.documents', 'assignedDriver', 'assignment', 'events',
            'vehicle', 'returnRecord', 'vehicleInspections', 'telematicsSetupSession.steps',
        ]);
        $outgoing = $booking->vehicleInspections->first(fn ($inspection) => $inspection->type->value === 'outgoing' && $inspection->status->value === 'finalized');
        $incoming = $booking->vehicleInspections->first(fn ($inspection) => $inspection->type->value === 'incoming' && $inspection->status->value === 'finalized');
        $selfDrive = $booking->rental_type === RentalType::SelfDrive;
        $testMode = $selfDrive && app(TelematicsHandoverEligibilityService::class)->testModeEnabled();
        $documentsApproved = ! $selfDrive || $this->documentsApproved($booking);
        $driverAssigned = $selfDrive || $booking->assignedDriver !== null;
        $driverEligible = $selfDrive || ($booking->assignedDriver
            && $booking->assignedDriver->is_active
            && $booking->assignedDriver->hasRole(DriverAssignmentService::DRIVER_ROLE)
            && ! $this->charges->hasOutstanding($booking->assignedDriver, AdditionalChargeResponsibility::Driver));

        return [
            'bookingConfirmed' => $booking->status === BookingStatus::Confirmed,
            'rentalPeriodEligible' => app(TelematicsHandoverEligibilityService::class)->isRentalTimeEligible($booking),
            'outgoingInspectionTimeEligible' => app(TelematicsHandoverEligibilityService::class)->isSetupTimeEligible($booking),
            'customerSelfDriveAvailable' => app(SelfDriveBookingAvailabilityService::class)->canHandover($booking),
            'paymentAcceptedForInspection' => $testMode || in_array($booking->payment_status, [PaymentStatus::Partial, PaymentStatus::Paid], true),
            'fullyPaid' => $testMode || ($booking->payment_status === PaymentStatus::Paid && (float) $booking->remaining_balance <= 0),
            'ageEligible' => $testMode || CustomerAgePolicy::isEligible($booking->user->customerProfile?->birthdate),
            'documentsApproved' => $testMode || $documentsApproved,
            'emergencyContactOnFile' => $testMode || ! $selfDrive || $booking->user->hasCompleteEmergencyContact(),
            'driverAssigned' => $driverAssigned,
            'driverEligible' => (bool) $driverEligible,
            'vehicleOperational' => $booking->vehicle?->status === VehicleStatus::Available
                && ! Booking::where('vehicle_id', $booking->vehicle_id)->whereKeyNot($booking->id)->where('status', 'ongoing')->exists(),
            'outgoingFinalized' => $testMode || $outgoing !== null,
            'telematicsSetupRequired' => app(TelematicsOperatorService::class)->supports($booking),
            'telematicsSetupReady' => ! app(TelematicsOperatorService::class)->supports($booking) || ($booking->telematicsSetupSession?->status === TelematicsSetupStatus::ReadyForRelease
                && $this->telematicsSetup->isReady($booking->telematicsSetupSession)),
            'vehicleReceived' => $booking->returnRecord?->vehicle_received_at !== null,
            'incomingFinalized' => $incoming !== null,
            'returnChargesFinalized' => $booking->return_charges_finalized_at !== null,
            'customerBalance' => (float) $booking->remaining_balance,
            'customerChargesSettled' => ! $booking->additionalCharges()
                ->where('responsibility', AdditionalChargeResponsibility::Customer->value)
                ->outstanding()
                ->exists(),
        ];
    }

    public function assertOutgoingAllowed(Booking $booking): void
    {
        $this->assertOutgoingTimeAllowed($booking);
        $state = $this->evaluate($booking);
        $required = ['bookingConfirmed', 'paymentAcceptedForInspection', 'ageEligible', 'documentsApproved', 'driverAssigned', 'driverEligible', 'vehicleOperational'];
        $this->assertChecks($state, $required, 'Outgoing Inspection cannot begin until every rental-readiness requirement is met.');
    }

    public function assertOutgoingTimeAllowed(Booking $booking): void
    {
        if (! app(TelematicsHandoverEligibilityService::class)->isSetupTimeEligible($booking)) {
            throw ValidationException::withMessages(['booking' => [
                'Outgoing Inspection is available from the pickup date until the rental ends.',
            ]]);
        }
    }

    public function assertStartAllowed(Booking $booking): void
    {
        if ($booking->rental_end_at?->lte(now())) {
            throw ValidationException::withMessages(['booking' => ['The scheduled rental period has ended. Resolve this booking before releasing a vehicle.']]);
        }
        if (! app(TelematicsHandoverEligibilityService::class)->isRentalTimeEligible($booking)) {
            throw ValidationException::withMessages(['booking' => ['The reserved rental period has not started yet.']]);
        }
        $state = $this->evaluate($booking);
        app(SelfDriveBookingAvailabilityService::class)->assertHandoverAvailable($booking);
        $this->assertChecks($state, [
            'bookingConfirmed', 'fullyPaid', 'ageEligible', 'documentsApproved', 'emergencyContactOnFile', 'driverAssigned',
            'driverEligible', 'vehicleOperational', 'outgoingFinalized', 'telematicsSetupReady',
        ], 'The rental cannot start until payment, inspection, telematics setup, operator, and vehicle readiness are complete.');
        $this->availability->assertBookingIntervalAvailable($booking->vehicle_id, $booking->rental_start_at, $booking->rental_end_at, $booking->id);
    }

    public function assertIncomingAllowed(Booking $booking): void
    {
        if ($booking->status !== BookingStatus::Ongoing) {
            throw ValidationException::withMessages(['booking' => ['Incoming Inspection is only available for an ongoing rental.']]);
        }
        if (! $booking->returnRecord?->vehicle_received_at) {
            throw ValidationException::withMessages(['booking' => ['Record physical vehicle receipt before Incoming Inspection.']]);
        }
        if (! $this->evaluate($booking)['outgoingFinalized']) {
            throw ValidationException::withMessages(['booking' => ['A finalized Outgoing Inspection is required.']]);
        }
        if ($booking->telematicsTrips()->whereIn('status', ['started', 'paused'])->exists()) {
            throw ValidationException::withMessages(['booking' => ['End the active telematics trip before Incoming Inspection.']]);
        }
    }

    public function assertReturnAllowed(Booking $booking): void
    {
        $state = $this->evaluate($booking);
        if ($booking->status !== BookingStatus::Ongoing || ! $state['vehicleReceived'] || ! $state['incomingFinalized'] || ! $state['returnChargesFinalized']) {
            throw ValidationException::withMessages(['booking' => ['Finalize Incoming Inspection and return-charge review before marking the booking Returned.']]);
        }
    }

    public function assertCompleteAllowed(Booking $booking): void
    {
        $state = $this->evaluate($booking);
        if ($booking->status !== BookingStatus::Returned || ! $state['vehicleReceived'] || ! $state['incomingFinalized'] || ! $state['returnChargesFinalized']
            || $state['customerBalance'] > 0 || ! $state['customerChargesSettled']) {
            throw ValidationException::withMessages(['booking' => ['A Returned booking can be completed only after the customer balance is fully settled.']]);
        }
    }

    private function documentsApproved(Booking $booking): bool
    {
        $required = CustomerDocument::requiredSelfDriveDocumentsFor($booking->user);

        return $booking->user->documents->whereIn('document_type', $required)
            ->filter(fn ($document) => $document->status === DocumentStatus::Approved)->count() === count($required);
    }

    private function assertChecks(array $state, array $keys, string $message): void
    {
        $failed = collect($keys)->filter(fn ($key) => ! ($state[$key] ?? false))->values()->all();
        if ($failed !== []) {
            throw ValidationException::withMessages(['readiness' => [$message], 'requirements' => $failed]);
        }
    }
}
