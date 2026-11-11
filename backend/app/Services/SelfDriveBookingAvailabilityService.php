<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

class SelfDriveBookingAvailabilityService
{
    public function lockCustomer(int $userId): void
    {
        // Shared mutex for booking creation, handover and release, including
        // requests for different vehicles on the same customer account.
        User::query()->whereKey($userId)->lockForUpdate()->firstOrFail();
    }

    public function assertReservationAvailable(User $customer, mixed $start, mixed $end, ?int $ignoreBookingId = null): void
    {
        $conflict = Booking::query()->where('user_id', $customer->id)
            ->where('rental_type', RentalType::SelfDrive->value)
            ->when($ignoreBookingId, fn ($query) => $query->whereKeyNot($ignoreBookingId))
            ->whereIn('status', [BookingStatus::Pending, BookingStatus::Confirmed, BookingStatus::Ongoing])
            ->where('rental_start_at', '<', $end)->where('rental_end_at', '>', $start)
            ->exists();

        if ($conflict) {
            throw ValidationException::withMessages([
                'rental_start_at' => ['You already have a self-drive booking during this rental period. Choose non-overlapping dates.'],
            ]);
        }
    }

    public function assertCustomerBookingAvailable(User $customer): void
    {
        $hasActiveBooking = Booking::query()
            ->where('user_id', $customer->id)
            ->whereIn('status', [
                BookingStatus::Pending,
                BookingStatus::Confirmed,
                BookingStatus::Ongoing,
                BookingStatus::Returned,
            ])
            ->exists();

        if ($hasActiveBooking) {
            throw ValidationException::withMessages([
                'booking' => ['Finish your active booking before creating another booking.'],
            ]);
        }
    }

    public function canHandover(Booking $booking): bool
    {
        if ($booking->rental_type !== RentalType::SelfDrive) {
            return true;
        }

        return ! $this->activeHandoversForCustomer($booking->user_id)->whereKeyNot($booking->id)->exists();
    }

    public function activeHandoversForCustomer(int $userId): Builder
    {
        return Booking::query()->where('user_id', $userId)
            ->where('rental_type', RentalType::SelfDrive->value)
            ->where(function ($query) {
                $query->where('status', BookingStatus::Ongoing->value)
                    ->orWhere(function ($query) {
                        $query->where('status', BookingStatus::Confirmed->value)
                            ->whereHas('telematicsSetupSession', fn ($session) => $session->whereIn('status', ['in_progress', 'ready_for_release']));
                    });
            });
    }

    public function assertHandoverAvailable(Booking $booking): void
    {
        if (! $this->canHandover($booking)) {
            throw ValidationException::withMessages([
                'telematics_setup' => ['Another self-drive rental or handover is active for this customer. Staff must resolve it before continuing.'],
            ]);
        }
    }
}
