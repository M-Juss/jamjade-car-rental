<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Mail\BookingDriverUpdateMail;
use App\Models\Booking;
use App\Models\BookingDriverUpdate;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Throwable;

class BookingDriverUpdateService
{
    public function record(Booking $booking, User $driver, string $kind): void
    {
        $title = match ($kind) {
            'assigned' => 'Driver assigned',
            'reassigned' => 'Driver updated',
            'on_way' => 'Driver on the way',
            'arrived' => 'Driver arrived',
        };
        $message = match ($kind) {
            'assigned', 'reassigned' => "{$driver->name} is your assigned driver.",
            'on_way' => "{$driver->name} is on the way to your pickup location.",
            'arrived' => "{$driver->name} has arrived at your pickup location.",
        };
        $context = [
            'title' => $title, 'message' => $message, 'bookingCode' => $booking->booking_code,
            'pickupLocation' => $booking->pickup_location, 'occurredAt' => now()->toISOString(),
            'driver' => ['name' => $driver->name, 'email' => $driver->email, 'phoneNumber' => $driver->phone_number],
        ];
        app(NotificationService::class)->createForBooking($booking, 'booking', $title, $message, [
            'action' => 'view_booking', 'action_label' => 'View Booking',
            'driver' => $context['driver'],
            'full_message' => $message."\nDriver: {$driver->name}\nEmail: {$driver->email}\nContact number: {$driver->phone_number}",
        ]);
        $update = BookingDriverUpdate::create([
            'booking_id' => $booking->id, 'driver_id' => $driver->id, 'kind' => $kind, 'context' => $context,
        ]);
        // The durable row also recovers an interrupted after-commit dispatch.
        DB::afterCommit(fn () => $this->deliver($update->id));
    }

    public function retryPending(): int
    {
        $ids = BookingDriverUpdate::query()->whereIn('delivery_status', ['pending', 'failed'])
            ->where(fn ($query) => $query->whereNull('retry_at')->orWhere('retry_at', '<=', now()))
            ->orderBy('id')->limit(50)->pluck('id');

        return $ids->filter(fn ($id) => $this->deliver($id))->count();
    }

    public function deliver(int $id): bool
    {
        try {
            return (bool) Cache::lock('booking-driver-update:'.$id, 120)->get(function () use ($id) {
                $update = BookingDriverUpdate::find($id);
                if (! $update || in_array($update->delivery_status, ['sent', 'skipped'], true)) {
                    return false;
                }
                $booking = $update->booking;
                if (! $booking || $booking->status->isTerminal()
                    || (int) $booking->assignment?->driver_id !== $update->driver_id
                    || ($update->kind === 'on_way' && $booking->assignment?->arrived_at)
                    || (in_array($update->kind, ['on_way', 'arrived'], true) && $booking->status !== BookingStatus::Confirmed)) {
                    $update->update(['delivery_status' => 'skipped']);

                    return false;
                }
                try {
                    $update->increment('attempts');
                    if (blank($booking->user?->email)) {
                        throw new \RuntimeException('Customer email is unavailable.');
                    }
                    Mail::to($booking->user->email)->send(new BookingDriverUpdateMail($update->context));
                    $update->update(['delivery_status' => 'sent', 'sent_at' => now(), 'retry_at' => null]);

                    return true;
                } catch (Throwable) {
                    $update->update(['delivery_status' => 'failed', 'retry_at' => now()->addMinutes(min(60, 5 * $update->attempts))]);

                    return false;
                }
            });
        } catch (Throwable) {
            // Mail/cache failures never reverse a committed assignment or pickup update.
            return false;
        }
    }
}
