<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FleetRentalResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $booking = $this->resource['booking'];
        $profile = $booking->user?->customerProfile;
        $customerName = trim(($profile?->first_name ?? '').' '.($profile?->last_name ?? ''));
        $trip = $booking->telematicsTrip;

        return [
            'id' => $booking->id,
            'bookingCode' => $booking->booking_code,
            'customerName' => $customerName ?: $booking->user?->name,
            'rentalType' => $booking->rental_type->value,
            'rentalStartAt' => $booking->rental_start_at?->toISOString(),
            'rentalEndAt' => $booking->rental_end_at?->toISOString(),
            'vehicle' => $booking->vehicle ? [
                'id' => $booking->vehicle->id,
                'name' => $booking->vehicle->name,
                'plateNumber' => $booking->vehicle->plate_number,
            ] : null,
            'tracking' => [
                'status' => $this->resource['trackingStatus'],
                'tripStatus' => in_array($booking->rental_type->value, ['self_drive', 'owners_driver'], true) ? $trip?->status : null,
                'lastLocationAt' => in_array($booking->rental_type->value, ['self_drive', 'owners_driver'], true) ? $trip?->last_location_at?->toISOString() : null,
                'location' => $this->resource['location'],
            ],
        ];
    }
}
