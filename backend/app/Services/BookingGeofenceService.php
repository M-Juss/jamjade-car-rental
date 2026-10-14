<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\BookingGeofence;
use App\Models\Geofence;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BookingGeofenceService
{
    public function saveCustom(Booking $booking, array $values, User $actor, ?BookingGeofence $zone = null): BookingGeofence
    {
        return DB::transaction(function () use ($booking, $values, $actor, $zone) {
            $booking = Booking::query()->lockForUpdate()->findOrFail($booking->id);
            $this->assertEditable($booking);
            app(GeofenceGeometryService::class)->assertValid($values);
            if ($zone) {
                abort_unless($zone->booking_id === $booking->id && $zone->scope === 'custom', 404);
            }
            $attributes = [...$values, 'name_snapshot' => $values['name']];
            unset($attributes['name']);
            if ($zone) {
                $zone->update($attributes);

                return $zone->fresh();
            }

            return $booking->bookingGeofences()->create([
                ...$attributes, 'scope' => 'custom', 'assigned_by' => $actor->id, 'assigned_at' => now(),
            ]);
        });
    }

    public function deleteCustom(Booking $booking, BookingGeofence $zone): void
    {
        DB::transaction(function () use ($booking, $zone) {
            $booking = Booking::query()->lockForUpdate()->findOrFail($booking->id);
            $this->assertEditable($booking);
            abort_unless($zone->booking_id === $booking->id && $zone->scope === 'custom', 404);
            $zone->delete();
        });
    }

    public function freezeForRelease(Booking $booking): void
    {
        // Called under the existing Start Rental booking lock and transaction.
        if ($booking->rental_type !== RentalType::SelfDrive) {
            return;
        }
        $now = now();
        foreach (Geofence::query()->where('is_active', true)->orderBy('id')->lockForUpdate()->get() as $default) {
            $booking->bookingGeofences()->firstOrCreate(['source_geofence_id' => $default->id], [
                'scope' => 'default', 'name_snapshot' => $default->name,
                'geometry_type' => $default->geometry_type, 'center_latitude' => $default->center_latitude,
                'center_longitude' => $default->center_longitude, 'radius_meters' => $default->radius_meters,
                'polygon_coordinates' => $default->polygon_coordinates,
                'notify_on_enter' => $default->notify_on_enter, 'notify_on_exit' => $default->notify_on_exit,
                'assigned_at' => $now, 'frozen_at' => $now,
            ]);
        }
        $booking->bookingGeofences()->whereNull('frozen_at')->update(['frozen_at' => $now]);
        $booking->unsetRelation('bookingGeofences');
    }

    public function zonesFor(Booking $booking): Collection
    {
        $booking->loadMissing('bookingGeofences');
        $custom = $booking->bookingGeofences->sortBy('id')->values();
        if ($booking->started_at || $booking->telematicsSetupSession?->status?->value === 'released') {
            return $custom;
        }

        return Geofence::query()->where('is_active', true)->orderBy('name')->get()->map(fn (Geofence $zone) => new BookingGeofence([
            'scope' => 'default', 'name_snapshot' => $zone->name,
            'geometry_type' => $zone->geometry_type, 'center_latitude' => $zone->center_latitude,
            'center_longitude' => $zone->center_longitude, 'radius_meters' => $zone->radius_meters,
            'polygon_coordinates' => $zone->polygon_coordinates,
            'notify_on_enter' => $zone->notify_on_enter, 'notify_on_exit' => $zone->notify_on_exit,
        ]))->concat($custom);
    }

    private function assertEditable(Booking $booking): void
    {
        if ($booking->rental_type !== RentalType::SelfDrive || ! in_array($booking->status, [BookingStatus::Pending, BookingStatus::Confirmed], true)
            || $booking->started_at || $booking->bookingGeofences()->whereNotNull('frozen_at')->exists()) {
            throw ValidationException::withMessages(['geofence' => ['Custom monitoring zones can only be changed before a self-drive rental is released.']]);
        }
    }
}
