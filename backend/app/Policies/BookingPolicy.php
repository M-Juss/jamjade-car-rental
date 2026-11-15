<?php

namespace App\Policies;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
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
        return $user->hasRole('customer') && $booking->user_id === $user->id
            && $booking->status === BookingStatus::Pending && $booking->payment_status === PaymentStatus::Unpaid;
    }

    public function manage(User $user): bool
    {
        return $user->can('manage bookings');
    }
}
