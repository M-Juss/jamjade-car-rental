<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\VehicleMaintenanceRecord;
use Illuminate\Validation\ValidationException;

class VehicleAvailabilityService
{
    public function assertBookingIntervalAvailable(int $vehicleId, mixed $start, mixed $end, ?int $ignoreBookingId = null): void
    {
        $bookingConflict = Booking::query()->where('vehicle_id', $vehicleId)
            ->blockingVehicleDates()->overlappingSchedule($start, $end)
            ->when($ignoreBookingId, fn ($query, int $id) => $query->whereKeyNot($id))->exists();

        if ($bookingConflict) {
            throw ValidationException::withMessages([
                'rental_start_at' => ['This vehicle is already booked for one or more of the selected dates.'],
            ]);
        }

        if (VehicleMaintenanceRecord::query()->where('vehicle_id', $vehicleId)->blockingInterval($start, $end)->exists()) {
            throw ValidationException::withMessages([
                'rental_start_at' => ['This vehicle is unavailable during the selected maintenance schedule.'],
            ]);
        }
    }

    public function assertMaintenanceIntervalAvailable(int $vehicleId, mixed $start, mixed $end, ?int $ignoreRecordId = null): void
    {
        if (Booking::query()->where('vehicle_id', $vehicleId)->blockingVehicleDates()->overlappingSchedule($start, $end)->exists()) {
            throw ValidationException::withMessages([
                'scheduled_start' => ['This maintenance schedule conflicts with an existing booking. Choose another schedule or resolve the booking first.'],
            ]);
        }

        $conflict = VehicleMaintenanceRecord::query()->where('vehicle_id', $vehicleId)
            ->where(function ($query) use ($start, $end) {
                $query->where(function ($query) use ($start, $end) {
                    $query->where('status', 'scheduled')
                        ->where('scheduled_start', '<=', $end)
                        ->where('scheduled_end', '>=', $start);
                })->orWhere(function ($query) use ($end) {
                    $query->where('status', 'in_progress')
                        ->where('scheduled_start', '<=', $end);
                });
            })
            ->when($ignoreRecordId, fn ($query, int $id) => $query->whereKeyNot($id))->exists();

        if ($conflict) {
            throw ValidationException::withMessages([
                'scheduled_start' => ['This schedule overlaps another active maintenance record for the vehicle.'],
            ]);
        }
    }
}
