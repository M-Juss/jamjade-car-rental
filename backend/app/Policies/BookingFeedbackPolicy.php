<?php

namespace App\Policies;

use App\Models\BookingFeedback;
use App\Models\User;

class BookingFeedbackPolicy
{
    public function feature(User $user, BookingFeedback $feedback): bool
    {
        return $user->is_active && $user->hasRole('owner') && $user->can('view reports');
    }
}
