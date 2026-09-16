<?php

namespace App\Policies;

use App\Models\TelematicsTrip;
use App\Models\User;

class TelematicsTripPolicy
{
    public function view(User $user, TelematicsTrip $trip): bool
    {
        return $user->can('view fleet tracker') || $trip->operator_user_id === $user->id;
    }

    public function manage(User $user, TelematicsTrip $trip): bool
    {
        return $trip->operator_user_id === $user->id;
    }
}
