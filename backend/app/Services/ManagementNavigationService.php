<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\CustomerDocument;
use App\Models\User;
use Carbon\CarbonImmutable;

class ManagementNavigationService
{
    public function counts(User $user): array
    {
        $counts = ['bookings' => null, 'verification' => null];
        $now = CarbonImmutable::now();

        if ($user->can('manage bookings')) {
            $tomorrow = $now->setTimezone('Asia/Manila')->addDay()->startOfDay()->utc();
            $pickups = Booking::where('status', 'confirmed')
                ->where('rental_start_at', '<', $tomorrow)
                ->where('rental_end_at', '>', $now)->count();
            $counts['bookings'] = $pickups;
        }

        if ($user->can('review documents')) {
            $counts['verification'] = CustomerDocument::whereIn('document_type', CustomerDocument::REQUIRED_SELF_DRIVE_DOCUMENTS)
                ->where('status', 'pending')
                ->whereHas('user', fn ($query) => $query->role('customer'))->count();
        }

        return $counts;
    }
}
