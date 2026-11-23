<?php

namespace App\Policies;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\User;

class BookingPolicy
{
    public function leaveFeedback(User $user, Booking $booking): bool
    {
        return $user->is_active && $user->hasRole('customer') && $booking->user_id === $user->id;
    }

    public function operateDriverService(User $user, Booking $booking): bool
    {
        return $user->is_active && $user->hasRole('driver')
            && $booking->rental_type === RentalType::OwnersDriver
            && (int) $booking->assignment()->value('driver_id') === $user->id;
    }

    public function startRental(User $user, Booking $booking): bool
    {
        return ($user->is_active && $user->hasAnyRole(['owner', 'staff']) && $user->can('manage bookings'))
            || $this->operateDriverService($user, $booking);
    }

    public function view(User $user, Booking $booking): bool
    {
        return $user->can('manage bookings') || $booking->user_id === $user->id;
    }

    public function cancel(User $user, Booking $booking): bool
    {
        return $user->hasRole('customer') && $booking->user_id === $user->id
            && $booking->status === BookingStatus::Pending && $booking->payment_status === PaymentStatus::Unpaid;
    }

    public function manage(User $user): bool
    {
        return $user->can('manage bookings');
    }
}
