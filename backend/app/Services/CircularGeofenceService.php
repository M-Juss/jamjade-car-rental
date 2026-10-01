<?php

namespace App\Services;

use App\Models\BookingGeofence;

class CircularGeofenceService
{
    /** @return array{distance_meters: float, radius_meters: float, inside: bool} */
    public function evaluate(BookingGeofence $geofence, float $latitude, float $longitude): array
    {
        $earthRadiusMeters = 6371008.8;
        $latitudeDelta = deg2rad($latitude - (float) $geofence->center_latitude);
        $longitudeDelta = deg2rad($longitude - (float) $geofence->center_longitude);
        $originLatitude = deg2rad((float) $geofence->center_latitude);
        $pointLatitude = deg2rad($latitude);
        $haversine = sin($latitudeDelta / 2) ** 2
            + cos($originLatitude) * cos($pointLatitude) * sin($longitudeDelta / 2) ** 2;
        $distance = $earthRadiusMeters * 2 * atan2(sqrt($haversine), sqrt(1 - $haversine));
        $radius = (float) $geofence->radius_meters;
        // Haversine arithmetic can produce an insignificant floating-point
        // overrun for a point mathematically on the boundary.
        $boundaryToleranceMeters = 0.000001;

        return [
            'distance_meters' => round($distance, 2),
            'radius_meters' => $radius,
            'inside' => $distance <= $radius + $boundaryToleranceMeters,
        ];
    }
}
