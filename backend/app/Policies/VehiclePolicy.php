<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Vehicle;

class VehiclePolicy
{
    public function viewAny(?User $user): bool
    {
        return true;
    }

    public function view(?User $user, Vehicle $vehicle): bool
    {
        return true;
    }

    public function manage(User $user): bool
    {
        return $user->can('manage vehicles');
    }
}
