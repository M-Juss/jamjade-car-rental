<?php

namespace App\Services;

use App\Enums\AdditionalChargeResponsibility;
use App\Enums\BookingStatus;
use App\Enums\DocumentStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
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
        private readonly VehicleAvailabilityService $availability
    ) {}

    public function evaluate(Booking $booking): array
    {
        $booking->loadMissing([
            'user.customerProfile', 'user.documents', 'assignedDriver', 'assignment', 'events',
            'vehicle', 'vehicleInspections',
        ]);
        $outgoing = $booking->vehicleInspections->first(fn ($inspection) => $inspection->type->value === 'outgoing' && $inspection->status->value === 'finalized');
        $incoming = $booking->vehicleInspections->first(fn ($inspection) => $inspection->type->value === 'incoming' && $inspection->status->value === 'finalized');
        $selfDrive = $booking->rental_type === RentalType::SelfDrive;
        $documentsApproved = ! $selfDrive || $this->documentsApproved($booking);
        $driverAssigned = $selfDrive || $booking->assignedDriver !== null;
        $driverEligible = $selfDrive || ($booking->assignedDriver
            && $booking->assignedDriver->is_active
            && $booking->assignedDriver->hasRole(DriverAssignmentService::DRIVER_ROLE)
            && ! $this->charges->hasOutstanding($booking->assignedDriver, AdditionalChargeResponsibility::Driver));

        return [
            'bookingConfirmed' => $booking->status === BookingStatus::Confirmed,
            'paymentAcceptedForInspection' => in_array($booking->payment_status, [PaymentStatus::Partial, PaymentStatus::Paid], true),
            'fullyPaid' => $booking->payment_status === PaymentStatus::Paid && (float) $booking->remaining_balance <= 0,
            'ageEligible' => CustomerAgePolicy::isEligible($booking->user->customerProfile?->birthdate),
            'documentsApproved' => $documentsApproved,
            'driverAssigned' => $driverAssigned,
            'driverEligible' => (bool) $driverEligible,
            'vehicleOperational' => $booking->vehicle?->status === VehicleStatus::Available,
            'outgoingFinalized' => $outgoing !== null,
            'calibrationAvailable' => $outgoing !== null,
            'calibrationPassed' => $booking->calibration_status === 'passed' && $booking->calibrated_at !== null,
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
        $state = $this->evaluate($booking);
        $required = ['bookingConfirmed', 'paymentAcceptedForInspection', 'ageEligible', 'documentsApproved', 'driverAssigned', 'driverEligible', 'vehicleOperational'];
        $this->assertChecks($state, $required, 'Outgoing Inspection cannot begin until every rental-readiness requirement is met.');
    }

    public function assertStartAllowed(Booking $booking): void
    {
        $state = $this->evaluate($booking);
        $this->assertChecks($state, [
            'bookingConfirmed', 'fullyPaid', 'ageEligible', 'documentsApproved', 'driverAssigned',
            'driverEligible', 'vehicleOperational', 'outgoingFinalized', 'calibrationPassed',
        ], 'The rental cannot start until payment, inspection, calibration, operator, and vehicle readiness are complete.');
        $this->availability->assertBookingIntervalAvailable($booking->vehicle_id, $booking->rental_start_at, $booking->rental_end_at, $booking->id);
    }

    public function assertIncomingAllowed(Booking $booking): void
    {
        if ($booking->status !== BookingStatus::Ongoing) {
            throw ValidationException::withMessages(['booking' => ['Incoming Inspection is only available for an ongoing rental.']]);
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
        if ($booking->status !== BookingStatus::Ongoing || ! $state['incomingFinalized'] || ! $state['returnChargesFinalized']) {
            throw ValidationException::withMessages(['booking' => ['Finalize Incoming Inspection and return-charge review before marking the booking Returned.']]);
        }
    }

    public function assertCompleteAllowed(Booking $booking): void
    {
        $state = $this->evaluate($booking);
        if ($booking->status !== BookingStatus::Returned || ! $state['incomingFinalized'] || ! $state['returnChargesFinalized']
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
