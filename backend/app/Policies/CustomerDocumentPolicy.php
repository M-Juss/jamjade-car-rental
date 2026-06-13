<?php

namespace App\Policies;

use App\Models\CustomerDocument;
use App\Models\User;

class CustomerDocumentPolicy
{
    public function view(User $user, CustomerDocument $document): bool
    {
        return $user->can('review documents') || $document->user_id === $user->id;
    }

    public function upload(User $user): bool
    {
        return $user->hasRole('customer');
    }

    public function review(User $user): bool
    {
        return $user->can('review documents');
    }
}
