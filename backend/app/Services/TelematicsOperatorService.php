<?php

namespace App\Services;

use App\Enums\RentalType;
use App\Enums\VehicleInspectionSignerType;
use App\Models\Booking;
use App\Models\User;

class TelematicsOperatorService
{
    public function supports(Booking $booking): bool
    {
        return in_array($booking->rental_type, [RentalType::SelfDrive, RentalType::OwnersDriver], true);
    }

    public function operatorId(Booking $booking): ?int
    {
        return $booking->rental_type === RentalType::SelfDrive
            ? (int) $booking->user_id
            : ($booking->rental_type === RentalType::OwnersDriver ? ($booking->assignment?->driver_id === null ? null : (int) $booking->assignment->driver_id) : null);
    }

    public function isOperator(Booking $booking, User $user): bool
    {
        if (! $this->supports($booking) || $this->operatorId($booking) !== (int) $user->id) {
            return false;
        }

        return $booking->rental_type === RentalType::SelfDrive
            ? $user->hasRole('customer')
            : $user->is_active && $user->hasRole(DriverAssignmentService::DRIVER_ROLE)
                && (int) $booking->assignment?->driver_id === (int) $user->id;
    }

    public function inspectionSigner(Booking $booking): VehicleInspectionSignerType
    {
        return $booking->rental_type === RentalType::SelfDrive
            ? VehicleInspectionSignerType::Renter
            : VehicleInspectionSignerType::Driver;
    }
}
