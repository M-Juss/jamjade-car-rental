<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('fleet-monitoring', fn (User $user) => $user->is_active
    && ! $user->hasRole('driver') && $user->hasAnyRole(['admin', 'staff'])
    && $user->can('view fleet tracker'), ['guards' => ['web']]);
