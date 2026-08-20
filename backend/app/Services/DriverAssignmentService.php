<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\ValidationException;

class DriverAssignmentService
{
    public const DRIVER_ROLE = 'driver';

    /**
     * Active staff users holding the driver role, ordered by id.
     *
     * @return Collection<int, User>
     */
    public function driverCandidates(): Collection
    {
        return User::query()
            ->where('is_active', true)
            ->role(self::DRIVER_ROLE)
            ->orderBy('id')
            ->get();
    }

    public function isAvailableFor(User $driver, Booking $booking): bool
    {
        $hasOverlap = Booking::query()
            ->where('assigned_driver_id', $driver->id)
            ->whereKeyNot($booking->id)
            ->where('rental_type', RentalType::OwnersDriver->value)
            ->whereIn('status', [
                BookingStatus::Pending->value,
                BookingStatus::Confirmed->value,
                BookingStatus::Ongoing->value,
            ])
            ->where('rental_start_at', '<', $booking->rental_end_at)
            ->where('rental_end_at', '>', $booking->rental_start_at)
            ->exists();

        return ! $hasOverlap;
    }

    public function autoAssign(Booking $booking): ?User
    {
        if ($booking->rental_type !== RentalType::OwnersDriver) {
            return null;
        }

        if ($booking->assigned_driver_id !== null) {
            return $booking->assignedDriver;
        }

        $driver = $this->driverCandidates()
            ->first(fn (User $candidate) => $this->isAvailableFor($candidate, $booking));

        if ($driver === null) {
            return null;
        }

        $this->persistAssignment($booking, $driver);

        return $driver;
    }

    public function assign(Booking $booking, User $driver): User
    {
        if ($booking->rental_type !== RentalType::OwnersDriver) {
            throw ValidationException::withMessages([
                'driver_id' => ['This booking does not use an owner\'s driver.'],
            ]);
        }

        if (! $driver->is_active || ! $driver->hasRole(self::DRIVER_ROLE)) {
            throw ValidationException::withMessages([
                'driver_id' => ['The selected staff member is not an active driver.'],
            ]);
        }

        if (! $this->isAvailableFor($driver, $booking)) {
            throw ValidationException::withMessages([
                'driver_id' => ['This driver is already assigned to an overlapping booking.'],
            ]);
        }

        $this->persistAssignment($booking, $driver);

        return $driver;
    }

    /**
     * Drivers the given booking could still be assigned to.
     *
     * @return Collection<int, User>
     */
    public function availableDriversFor(Booking $booking): Collection
    {
        return $this->driverCandidates()
            ->filter(fn (User $driver) => $this->isAvailableFor($driver, $booking))
            ->values();
    }

    private function persistAssignment(Booking $booking, User $driver): void
    {
        $booking->forceFill([
            'assigned_driver_id' => $driver->id,
            'driver_assigned_at' => now(),
        ])->save();
    }
}
