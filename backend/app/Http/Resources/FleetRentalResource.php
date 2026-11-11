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
        $operator = $trip?->operator ?? ($booking->rental_type->value === 'self_drive' ? $booking->user : $booking->assignedDriver);

        return [
            'id' => $booking->id,
            'bookingCode' => $booking->booking_code,
            'customerName' => $customerName ?: $booking->user?->name,
            'operator' => $operator ? [
                'id' => $operator->id,
                'name' => $operator->id === $booking->user_id ? ($customerName ?: $operator->name) : $operator->name,
                'email' => $operator->email,
                'phoneNumber' => $operator->phone_number,
            ] : null,
            'geofenceActivity' => $booking->telematicsEvents()
                ->whereIn('event_type', ['geofence_enter', 'geofence_exit'])
                ->orderByDesc('occurred_at')->limit(30)->get()
                ->map(fn ($event) => [
                    'id' => (string) $event->id,
                    'type' => $event->event_type->value,
                    'zoneName' => $event->metadata['zone_name'] ?? 'Monitoring zone',
                    'notificationRequested' => (bool) ($event->metadata['notification_requested'] ?? false),
                    'occurredAt' => $event->occurred_at?->toISOString(),
                ])->values(),
            'rentalType' => $booking->rental_type->value,
            'rentalStartAt' => $booking->rental_start_at?->toISOString(),
            'rentalEndAt' => $booking->rental_end_at?->toISOString(),
            'vehicle' => $booking->vehicle ? [
                'id' => $booking->vehicle->id,
                'name' => $booking->vehicle->name,
                'brand' => $booking->vehicle->brand,
                'model' => $booking->vehicle->model,
                'plateNumber' => $booking->vehicle->plate_number,
            ] : null,
            'activityCounts' => $this->resource['activityCounts'],
            'tracking' => [
                'status' => $this->resource['trackingStatus'],
                'tripStatus' => in_array($booking->rental_type->value, ['self_drive', 'owners_driver'], true) ? $trip?->status : null,
                'lastLocationAt' => in_array($booking->rental_type->value, ['self_drive', 'owners_driver'], true) ? $trip?->last_location_at?->toISOString() : null,
                'location' => $this->resource['location'],
            ],
        ];
    }
}
