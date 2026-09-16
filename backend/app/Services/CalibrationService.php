<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CalibrationService
{
    public function recordPassed(Booking $booking, User $user): Booking
    {
        return DB::transaction(function () use ($booking, $user) {
            $booking = Booking::query()->with(['assignedDriver', 'user'])->lockForUpdate()->findOrFail($booking->id);
            $operatorId = $booking->rental_type === RentalType::SelfDrive
                ? $booking->user_id
                : $booking->assigned_driver_id;

            if ($operatorId !== $user->id) {
                abort(403, 'Only the authorized renter or assigned Driver may calibrate this booking.');
            }
            if ($booking->status !== BookingStatus::Confirmed
                || ! $booking->vehicleInspections()->where('type', 'outgoing')->where('status', 'finalized')->exists()) {
                throw ValidationException::withMessages(['calibration' => ['Calibration is available only after finalized Outgoing Inspection.']]);
            }

            $booking->assignment()->updateOrCreate([], [
                'calibration_status' => 'passed',
                'calibrated_by' => $user->id,
                'calibrated_at' => now(),
            ]);
            $booking->unsetRelation('assignment');
            $booking->unsetRelation('assignedDriver');

            activity()->causedBy($user)->performedOn($booking)->event('booking_calibration_passed')
                ->log('Booking mobile calibration passed.');

            return $booking->fresh([
                'vehicle.images', 'vehicle.features', 'payments', 'user.documents', 'user.customerProfile',
                'assignedDriver', 'assignment', 'terms', 'confirmationEmail', 'events', 'vehicleInspections',
            ]);
        });
    }
}
