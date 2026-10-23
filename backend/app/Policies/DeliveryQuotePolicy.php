<?php

namespace App\Policies;

use App\Models\DeliveryQuote;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class DeliveryQuotePolicy
{
    public function view(User $user, DeliveryQuote $quote): Response
    {
        return $user->id === $quote->user_id || $user->can('manage bookings') ? Response::allow() : Response::denyAsNotFound();
    }
}
