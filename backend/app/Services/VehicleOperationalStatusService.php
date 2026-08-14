<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\MaintenanceRecordStatus;
use App\Enums\VehicleStatus;
use App\Models\Vehicle;

class VehicleOperationalStatusService
{
    public function afterBookingEnded(Vehicle $vehicle): void
    {
        $vehicle->refresh();
        if ($vehicle->maintenanceRecords()->where('status', MaintenanceRecordStatus::InProgress)->exists()) {
            $vehicle->update(['status' => VehicleStatus::Maintenance]);
        } elseif ($vehicle->status === VehicleStatus::Rented) {
            $vehicle->update(['status' => VehicleStatus::Available]);
        }
    }

    public function afterMaintenanceEnded(Vehicle $vehicle): void
    {
        $vehicle->refresh();
        if ($vehicle->bookings()->where('status', BookingStatus::Ongoing)->exists()) {
            $vehicle->update(['status' => VehicleStatus::Rented]);
        } elseif ($vehicle->status === VehicleStatus::Maintenance) {
            $vehicle->update(['status' => VehicleStatus::Available]);
        }
    }
}
