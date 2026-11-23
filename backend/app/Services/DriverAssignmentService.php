<?php

namespace App\Services;

use App\Enums\AdditionalChargeResponsibility;
use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Enums\VehicleInspectionStatus;
use App\Enums\VehicleInspectionType;
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
            ->where(function ($query) use ($booking) {
                $query->where(fn ($overlap) => $overlap->where('rental_start_at', '<', $booking->rental_end_at)
                    ->where('rental_end_at', '>', $booking->rental_start_at));
                if ($booking->rental_start_at->lte(now())) {
                    $query->orWhere('status', BookingStatus::Ongoing->value);
                }
            })
            ->exists();

        return ! $hasOverlap;
    }

    public function isAvailableNow(User $driver, Booking $booking): bool
    {
        return ! Booking::query()->whereKeyNot($booking->id)->where('status', BookingStatus::Ongoing->value)
            ->whereHas('assignment', fn ($query) => $query->where('driver_id', $driver->id))->exists();
    }

    public function hasOutstandingBalance(User $driver): bool
    {
        return $this->charges->hasOutstanding($driver, AdditionalChargeResponsibility::Driver);
    }

    public function autoAssign(Booking $booking): ?User
    {
        return DB::transaction(function () use ($booking) {
            $booking = Booking::query()->lockForUpdate()->findOrFail($booking->id);
            if ($booking->rental_type !== RentalType::OwnersDriver || ! in_array($booking->status, [BookingStatus::Pending, BookingStatus::Confirmed], true)) {
                return null;
            }
            if ($booking->assignment()->whereNotNull('driver_id')->exists()) {
                return $booking->assignedDriver;
            }
            if ($this->assignmentLocked($booking)) {
                return null;
            }
            foreach ($this->driverCandidates() as $candidate) {
                // Recheck availability under the Driver lock shared by other assignments.
                $driver = User::query()->lockForUpdate()->find($candidate->id);
                if (! $driver || ! $driver->is_active || $driver->roles()->lockForUpdate()->pluck('name')->all() !== [self::DRIVER_ROLE]
                    || ! preg_match('/^09\d{9}$/', (string) $driver->phone_number) || ! $this->isAvailableFor($driver, $booking)) {
                    continue;
                }
                $this->persistAssignment($booking, $driver);

                return $driver;
            }

            return null;
        });
    }

    public function assignmentLocked(Booking $booking): bool
    {
        return $booking->vehicleInspections()->where('type', VehicleInspectionType::Outgoing->value)
            ->where('status', VehicleInspectionStatus::Finalized->value)->exists();
    }

    public function assign(Booking $booking, User $driver, ?User $actor = null): User
    {
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
                && preg_match('/^09\d{9}$/', (string) $driver->phone_number))
            ->values();
    }

    private function persistAssignment(Booking $booking, User $driver, ?User $actor = null): void
    {
        DB::transaction(function () use ($booking, $driver, $actor) {
            // Match telematics setup/release lock order so assignment changes cannot
            // race with evidence being recorded by the current operator.
            $booking = Booking::query()->lockForUpdate()->findOrFail($booking->id);
            if ($booking->rental_type !== RentalType::OwnersDriver
                || ! in_array($booking->status, [BookingStatus::Pending, BookingStatus::Confirmed], true)) {
                throw ValidationException::withMessages([
                    'driver_id' => ['Drivers can only be assigned to With Assigned Driver bookings before the rental starts.'],
                ]);
            }

            if ($this->assignmentLocked($booking)) {
                throw ValidationException::withMessages(['driver_id' => ['The driver cannot be changed after Outgoing Inspection is finalized.']]);
            }

            // Serialize assignment writes with personnel deactivation and conversion.
            $driver = User::query()->lockForUpdate()->findOrFail($driver->id);
            $roles = $driver->roles()->lockForUpdate()->pluck('name');
            if (! $driver->is_active || $roles->all() !== [self::DRIVER_ROLE]) {
                throw ValidationException::withMessages([
                    'driver_id' => ['The selected account is not an active Driver.'],
                ]);
            }
            if (! $this->isAvailableFor($driver, $booking)) {
                throw ValidationException::withMessages([
                    'driver_id' => ['This driver is already assigned to an overlapping booking.'],
                ]);
            }
            if (! preg_match('/^09\d{9}$/', (string) $driver->phone_number)) {
                throw ValidationException::withMessages(['driver_id' => ['Add a valid contact number to the Driver account before assigning it.']]);
            }

            $previousDriver = $booking->assignedDriver()->first();
            if ($previousDriver?->id === $driver->id) {
                return;
            }
            $booking->assignment()->updateOrCreate([], [
                'driver_id' => $driver->id,
                'assigned_at' => now(),
                'on_way_at' => null,
                'arrived_at' => null,
            ]);
            $booking->unsetRelation('assignment');
            $booking->unsetRelation('assignedDriver');
            $booking->load(['assignment', 'assignedDriver']);
            app(TelematicsSetupService::class)->refreshAfterOperatorChange($booking);

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

            app(BookingDriverUpdateService::class)->record($booking, $driver, $previousDriver ? 'reassigned' : 'assigned');
            $booking->events()->create([
                'event_type' => $previousDriver ? 'driver_reassigned' : 'driver_assigned',
                'actor_user_id' => $actor?->id,
                'reason' => $previousDriver ? 'Assigned driver updated.' : 'Driver assigned.',
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
