<?php

namespace App\Services;

class GeofenceService
{
    public function severityForStatus(string $status): string
    {
        return match ($status) {
            'outside' => 'high',
            'near_boundary' => 'medium',
            'gps_unavailable' => 'high',
            default => 'low',
        };
    }
}
