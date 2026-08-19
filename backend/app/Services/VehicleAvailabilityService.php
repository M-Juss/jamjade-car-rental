<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\VehicleMaintenanceRecord;
use Illuminate\Support\Carbon;
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

        $maintenanceStart = Carbon::parse($start)->startOfDay();
        $maintenanceEnd = Carbon::parse($end)->endOfDay();
        if (VehicleMaintenanceRecord::query()->where('vehicle_id', $vehicleId)
            ->blockingInterval($maintenanceStart, $maintenanceEnd, $start, $end)->exists()) {
            throw ValidationException::withMessages([
                'rental_start_at' => ['This vehicle is unavailable during the selected maintenance schedule.'],
            ]);
        }
    }

    public function assertMaintenanceIntervalAvailable(int $vehicleId, mixed $start, mixed $end, ?int $ignoreRecordId = null): void
    {
        $dayStart = Carbon::parse($start)->startOfDay();
        $dayEnd = Carbon::parse($end)->endOfDay();

        if (Booking::query()->where('vehicle_id', $vehicleId)->blockingVehicleDates()->overlappingSchedule($dayStart, $dayEnd)->exists()) {
            throw ValidationException::withMessages([
                'scheduled_start' => ['This maintenance schedule conflicts with an existing booking. Choose another schedule or resolve the booking first.'],
            ]);
        }

        $conflict = VehicleMaintenanceRecord::query()->where('vehicle_id', $vehicleId)
            ->where(function ($query) use ($dayStart, $dayEnd) {
                $query->where(function ($query) use ($dayStart, $dayEnd) {
                    $query->where('status', 'scheduled')
                        ->where('scheduled_start', '<=', $dayEnd)
                        ->where('scheduled_end', '>=', $dayStart);
                })->orWhere(function ($query) use ($dayEnd) {
                    $query->where('status', 'in_progress')
                        ->where('scheduled_start', '<=', $dayEnd);
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
