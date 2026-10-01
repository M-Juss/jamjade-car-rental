<?php

namespace App\Services;

use App\Enums\AdditionalChargeResponsibility;
use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DriverAssignmentService
{
    public const DRIVER_ROLE = 'driver';

    public function __construct(
        private readonly AdditionalChargeService $charges,
        private readonly NotificationService $notifications
    ) {}

    /**
     * Active personnel accounts holding only the Driver role, ordered by id.
     *
     * @return Collection<int, User>
     */
    public function driverCandidates(): Collection
    {
        return User::query()
            ->where('is_active', true)
            ->role(self::DRIVER_ROLE)
            ->has('roles', '=', 1)
            ->orderBy('id')
            ->get();
    }

    public function isAvailableFor(User $driver, Booking $booking): bool
    {
        $hasOverlap = Booking::query()
            ->whereHas('assignment', fn ($query) => $query->where('driver_id', $driver->id))
            ->whereKeyNot($booking->id)
            ->where('rental_type', RentalType::OwnersDriver->value)
            ->whereIn('status', [
                BookingStatus::Confirmed->value,
                BookingStatus::Ongoing->value,
            ])
            ->where('rental_start_at', '<', $booking->rental_end_at)
            ->where('rental_end_at', '>', $booking->rental_start_at)
            ->exists();

        return ! $hasOverlap;
    }

    public function hasOutstandingBalance(User $driver): bool
    {
        return $this->charges->hasOutstanding($driver, AdditionalChargeResponsibility::Driver);
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

    public function assign(Booking $booking, User $driver, ?User $actor = null): User
    {
        if ($booking->rental_type !== RentalType::OwnersDriver) {
            throw ValidationException::withMessages([
                'driver_id' => ['This booking does not use an owner\'s driver.'],
            ]);
        }

        if (! in_array($booking->status, [BookingStatus::Pending, BookingStatus::Confirmed], true)) {
            throw ValidationException::withMessages([
                'driver_id' => ['Drivers can only be assigned before the rental starts.'],
            ]);
        }

        if (! $driver->is_active || ! $driver->hasRole(self::DRIVER_ROLE)) {
            throw ValidationException::withMessages([
                'driver_id' => ['The selected account is not an active Driver.'],
            ]);
        }

        if (! $this->isAvailableFor($driver, $booking)) {
            throw ValidationException::withMessages([
                'driver_id' => ['This driver is already assigned to an overlapping booking.'],
            ]);
        }

        if ($this->hasOutstandingBalance($driver)) {
            throw ValidationException::withMessages([
                'driver_id' => ['This driver has an outstanding Driver-responsible balance and cannot receive a new assignment.'],
            ]);
        }

        $this->persistAssignment($booking, $driver, $actor);

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
            ->filter(fn (User $driver) => $this->isAvailableFor($driver, $booking)
                && ! $this->hasOutstandingBalance($driver))
            ->values();
    }

    private function persistAssignment(Booking $booking, User $driver, ?User $actor = null): void
    {
        DB::transaction(function () use ($booking, $driver, $actor) {
            // Serialize assignment writes with personnel deactivation and conversion.
            $driver = User::query()->lockForUpdate()->findOrFail($driver->id);
            $roles = $driver->roles()->lockForUpdate()->pluck('name');
            if (! $driver->is_active || $roles->all() !== [self::DRIVER_ROLE]) {
                throw ValidationException::withMessages([
                    'driver_id' => ['The selected account is not an active Driver.'],
                ]);
            }

            $previousDriver = $booking->assignedDriver;
            $booking->assignment()->updateOrCreate([], [
                'driver_id' => $driver->id,
                'assigned_at' => now(),
            ]);
            $booking->unsetRelation('assignment');
            $booking->unsetRelation('assignedDriver');

            if ($previousDriver && $previousDriver->id !== $driver->id) {
                $this->notifications->createForUser($previousDriver, 'booking', 'Service assignment changed',
                    "You are no longer assigned to booking {$booking->booking_code}.", [
                        'booking_id' => $booking->id, 'action' => 'view_services', 'action_label' => 'View Services',
                    ]);
            }

            $this->notifications->createForUser($driver, 'booking', 'New service assignment',
                "You are assigned to booking {$booking->booking_code}.", [
                    'booking_id' => $booking->id, 'action' => 'view_services', 'action_label' => 'View Services',
                ]);

            $activity = activity()->performedOn($booking)->event($previousDriver ? 'booking_driver_reassigned' : 'booking_driver_assigned')
                ->withProperties(['previous_driver_id' => $previousDriver?->id, 'driver_id' => $driver->id]);
            if ($actor) {
                $activity->causedBy($actor);
            }
            $activity->log($previousDriver ? 'Booking Driver reassigned.' : 'Booking Driver assigned.');
        });
    }
}
