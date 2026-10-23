<?php

namespace App\Http\Resources;

use App\Services\LocationMonitoringService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LocationMonitoringResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $booking = $this->resource['booking'];

        return [
            'bookingCode' => $booking->booking_code,
            'canMonitor' => app(LocationMonitoringService::class)->canMonitor($booking),
            'tripStatus' => $booking->telematicsTrip?->status,
            'lastLocationAt' => $booking->telematicsTrip?->last_location_at?->toISOString(),
            'sessionToken' => $this->when(isset($this->resource['sessionToken']), fn () => $this->resource['sessionToken']),
            'policy' => [
                'consentVersion' => config('telematics.foreground_location.consent_version'),
                'uploadIntervalSeconds' => config('telematics.foreground_location.upload_interval_seconds'),
                'maximumAccuracyMeters' => config('telematics.foreground_location.maximum_accuracy_meters'),
                'maximumAgeSeconds' => config('telematics.foreground_location.maximum_age_seconds'),
                'futureSkewSeconds' => config('telematics.foreground_location.future_skew_seconds'),
                'retentionHours' => config('telematics.foreground_location.retention_hours'),
            ],
        ];
    }
}
