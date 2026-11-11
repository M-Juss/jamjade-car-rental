<?php

namespace App\Http\Resources;

use App\Enums\MaintenanceRecordStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MaintenanceVehicleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $bookingRanges = $this->dateBlockingBookings->map(fn ($booking) => [
            'startDate' => $booking->rental_start_at->toDateString(),
            'endDate' => $booking->rental_end_at->toDateString(),
            'source' => 'booking',
            'label' => 'Booked',
            'openEnded' => false,
        ]);

        $maintenanceRanges = $this->activeMaintenanceRecords->map(fn ($record) => [
            'startDate' => $record->scheduled_start->toDateString(),
            'endDate' => $record->status === MaintenanceRecordStatus::InProgress
                ? null
                : $record->scheduled_end->toDateString(),
            'source' => 'maintenance',
            'label' => $record->status === MaintenanceRecordStatus::InProgress
                ? 'Maintenance in progress'
                : 'Scheduled maintenance',
            'openEnded' => $record->status === MaintenanceRecordStatus::InProgress,
        ]);

        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'plateNumber' => $this->plate_number,
            'status' => $this->status->value,
            'statusLabel' => $this->status->label(),
            'currentOdometer' => $this->currentCondition?->odometer,
            'unavailableDateRanges' => $bookingRanges->concat($maintenanceRanges)->values(),
        ];
    }
}
