<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DrivingAnalysisBookingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'backendId' => $this->id, 'id' => $this->booking_code, 'bookingCode' => $this->booking_code,
            'status' => $this->status->mobileLabel(), 'statusKey' => $this->status->value,
            'adminStatus' => $this->status->adminLabel(),
            'vehicleId' => (string) $this->vehicle_id, 'vehicleName' => $this->vehicle?->name,
            'vehiclePlateNumber' => $this->vehicle?->plate_number, 'brand' => $this->vehicle?->brand,
            'model' => $this->vehicle?->model, 'rentalStartAt' => $this->rental_start_at?->toISOString(),
            'rentalEndAt' => $this->rental_end_at?->toISOString(), 'durationDays' => $this->duration_days,
            'rentalType' => $this->rental_type->value, 'driverOption' => $this->driver_option,
            'customer' => ['id' => $this->user_id, 'name' => $this->user?->name],
            'assignedDriver' => $this->assignedDriver ? ['id' => $this->assignedDriver->id, 'name' => $this->assignedDriver->name] : null,
            'geofenceActivity' => $this->when($request->routeIs('admin.driving-analysis.booking'), fn () => $this->telematicsEvents()
                ->whereIn('event_type', ['geofence_enter', 'geofence_exit', 'geofence_initial_inside'])
                ->orderByDesc('occurred_at')->limit(100)->get()->map(fn ($event) => [
                    'id' => (string) $event->id, 'type' => $event->event_type->value,
                    'zoneName' => $event->metadata['zone_name'] ?? 'Monitoring zone',
                    'notificationRequested' => (bool) ($event->metadata['notification_requested'] ?? false),
                    'occurredAt' => $event->occurred_at?->toISOString(),
                ])->values()),
        ];
    }
}
