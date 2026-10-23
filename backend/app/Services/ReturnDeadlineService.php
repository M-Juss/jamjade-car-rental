<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ReturnDeadlineService
{
    public function process(): int
    {
        $sent = 0;
        $staff = User::permission('manage bookings')->where('is_active', true)
            ->whereHas('roles', fn ($query) => $query->whereIn('name', ['admin', 'staff']))->get();
        Booking::where('status', 'ongoing')->where('rental_end_at', '<=', now()->addHours(2))
            ->whereDoesntHave('returnRecord', fn ($query) => $query->whereNotNull('vehicle_received_at'))
            ->chunkById(100, function ($bookings) use ($staff, &$sent) {
                foreach ($bookings as $candidate) {
                    DB::transaction(function () use ($candidate, $staff, &$sent) {
                        $booking = Booking::with(['user', 'assignedDriver', 'returnRecord'])->lockForUpdate()->findOrFail($candidate->id);
                        if ($booking->status->value !== 'ongoing' || $booking->returnRecord?->vehicle_received_at) {
                            return;
                        }
                        $overdue = $booking->rental_end_at->lt(now());
                        $eventType = $overdue ? 'return_overdue_notified' : 'return_reminder_sent';
                        if ($booking->events()->where('event_type', $eventType)->exists()) {
                            return;
                        }
                        $booking->events()->create(['event_type' => $eventType]);
                        $recipients = collect([$booking->user, $booking->assignedDriver])->filter();
                        if ($overdue) {
                            $recipients = $recipients->merge($staff);
                        }
                        foreach ($recipients->unique('id') as $recipient) {
                            app(NotificationService::class)->createForUser($recipient, 'booking',
                                $overdue ? 'Vehicle return overdue' : 'Vehicle return due soon',
                                sprintf('Booking %s was scheduled for return at %s. %s', $booking->booking_code,
                                    $booking->rental_end_at->copy()->setTimezone('Asia/Manila')->format('M j, Y g:i A'),
                                    $overdue ? 'Contact Jamjade to coordinate the return. Late charges are reviewed after receipt.' : 'Please arrange your return on time.'),
                                ['booking_id' => $booking->id, 'priority' => $overdue ? 'urgent' : 'warning', 'action' => 'view_booking', 'action_label' => 'View Booking']);
                        }
                        $sent++;
                    });
                }
            });

        return $sent;
    }
}
