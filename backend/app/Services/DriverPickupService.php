<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class DriverPickupService
{
    public function projection(Booking $booking, ?User $viewer): ?array
    {
        if ($booking->rental_type !== RentalType::OwnersDriver) {
            return null;
        }
        $booking->loadMissing('assignment');
        $assignment = $booking->assignment;
        if (! $assignment?->driver_id) {
            return null;
        }
        $operator = $viewer && Gate::forUser($viewer)->allows('operateDriverService', $booking);
        $eligible = $operator && $booking->status === BookingStatus::Confirmed
            && app(TelematicsHandoverEligibilityService::class)->isSetupTimeEligible($booking)
            && app(DriverAssignmentService::class)->assignmentLocked($booking)
            && app(DriverAssignmentService::class)->isAvailableNow($viewer, $booking);
        $canStart = false;
        $releaseBlocker = null;
        if ($eligible && $assignment?->arrived_at && $booking->telematicsSetupSession?->status?->value === 'ready_for_release') {
            try {
                app(RentalReadinessService::class)->assertStartAllowed($booking);
                $canStart = true;
            } catch (ValidationException $exception) {
                $releaseBlocker = collect($exception->errors())->flatten()->first();
                $canStart = false;
            }
        }

        return [
            'status' => $assignment?->arrived_at ? 'arrived' : ($assignment?->on_way_at ? 'on_way' : 'assigned'),
            'onWayAt' => $assignment?->on_way_at?->toISOString(),
            'arrivedAt' => $assignment?->arrived_at?->toISOString(),
            'canReportOnWay' => $eligible && ! $assignment?->on_way_at && ! $assignment?->arrived_at,
            'canReportArrival' => $eligible && ! $assignment?->arrived_at
                && ($assignment?->on_way_at !== null || $booking->pickup_location_type === 'shop'),
            'canBeginSetup' => $eligible && $assignment?->arrived_at !== null
                && app(TelematicsHandoverEligibilityService::class)->evaluate($booking)['canWorkSetup'],
            'canStartRental' => $canStart,
            'setupComplete' => $booking->telematicsSetupSession?->status?->value === 'ready_for_release',
            'releaseBlocker' => $releaseBlocker,
        ];
    }

    public function act(Booking $booking, User $actor, string $action): Booking
    {
        return DB::transaction(function () use ($booking, $actor, $action) {
            $booking = Booking::query()->lockForUpdate()->findOrFail($booking->id);
            Gate::forUser($actor)->authorize('operateDriverService', $booking);
            if ($action === 'start_rental') {
                if ($booking->status === BookingStatus::Ongoing) {
                    return $booking;
                }

                return app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $actor);
            }
            if ($booking->status !== BookingStatus::Confirmed
                || ! app(TelematicsHandoverEligibilityService::class)->isSetupTimeEligible($booking)
                || ! app(DriverAssignmentService::class)->assignmentLocked($booking)) {
                throw ValidationException::withMessages(['action' => ['Pickup progress requires a confirmed booking, the pickup date, and finalized Outgoing Inspection.']]);
            }
            User::query()->lockForUpdate()->findOrFail($actor->id);
            if (! app(DriverAssignmentService::class)->isAvailableNow($actor, $booking)) {
                throw ValidationException::withMessages(['action' => ['Finish the other active service before heading to this pickup.']]);
            }
            $assignment = $booking->assignment()->lockForUpdate()->firstOrFail();
            if ($assignment->arrived_at || ($action === 'on_way' && $assignment->on_way_at)) {
                return $booking;
            }
            if ($action === 'arrived' && ! $assignment->on_way_at && $booking->pickup_location_type !== 'shop') {
                throw ValidationException::withMessages(['action' => ['Report that you are on the way before reporting arrival.']]);
            }
            $assignment->update([$action === 'on_way' ? 'on_way_at' : 'arrived_at' => now()]);
            $booking->setRelation('assignment', $assignment);
            $booking->events()->create(['event_type' => 'driver_'.$action, 'actor_user_id' => $actor->id]);
            app(BookingDriverUpdateService::class)->record($booking, $actor, $action);
            if ($action === 'arrived' && $booking->telematicsSetupSession?->status?->value === 'setup_required') {
                app(TelematicsSetupService::class)->startHandover($booking, $actor);
            }

            return $booking;
        });
    }
}
