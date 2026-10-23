<?php

namespace App\Policies;

use App\Models\RcResearchSession;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class RcResearchSessionPolicy
{
    public function view(User $user, RcResearchSession $session): Response
    {
        return $user->hasRole('admin') && (int) $session->user_id === $user->id
            ? Response::allow() : Response::denyAsNotFound();
    }
}
