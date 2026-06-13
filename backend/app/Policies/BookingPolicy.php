<?php

namespace App\Policies;

use App\Enums\BookingStatus;
use App\Models\Booking;
use App\Models\User;

class BookingPolicy
{
    public function view(User $user, Booking $booking): bool
    {
        return $user->can('manage bookings') || $booking->user_id === $user->id;
    }

    public function cancel(User $user, Booking $booking): bool
    {
        return $booking->user_id === $user->id
            && in_array($booking->status, [BookingStatus::Pending, BookingStatus::Confirmed], true);
    }

    public function manage(User $user): bool
    {
        return $user->can('manage bookings');
    }
}
