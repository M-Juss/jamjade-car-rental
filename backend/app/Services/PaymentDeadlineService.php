<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Models\Booking;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

class PaymentDeadlineService
{
    public function __construct(private readonly NotificationService $notificationService) {}

    public function process(?CarbonInterface $now = null): array
    {
        $now ??= now();
        $reminded = 0;
        $cancelled = 0;

        Booking::query()
            ->where('payment_status', PaymentStatus::Partial)
            ->whereIn('status', [BookingStatus::Pending, BookingStatus::Confirmed])
            ->whereNotNull('balance_due_at')
            ->whereNull('balance_reminder_sent_at')
            ->where('balance_due_at', '>', $now)
            ->where('balance_due_at', '<=', $now->copy()->addDay())
            ->each(function (Booking $booking) use ($now, &$reminded) {
                $booking->forceFill(['balance_reminder_sent_at' => $now])->save();
                $this->notificationService->createForBooking(
                    $booking,
                    'payment',
                    'Remaining balance due soon',
                    sprintf(
                        'Pay PHP %s by %s to keep booking %s active.',
                        number_format((float) $booking->remaining_balance, 2),
                        $booking->balance_due_at->format('F j, Y - g:i A'),
                        $booking->booking_code
                    ),
                    [
                        'priority' => 'urgent',
                        'action_label' => 'Pay Remaining Balance',
                        'action' => 'pay_balance',
                        'remaining_balance' => (float) $booking->remaining_balance,
                        'due_at' => $booking->balance_due_at->toISOString(),
                        'non_refundable' => true,
                    ]
                );
                $reminded++;
            });

        Booking::query()
            ->where('payment_status', PaymentStatus::Partial)
            ->whereIn('status', [BookingStatus::Pending, BookingStatus::Confirmed])
            ->whereNotNull('balance_due_at')
            ->where('balance_due_at', '<=', $now)
            ->pluck('id')
            ->each(function (int $bookingId) use ($now, &$cancelled) {
                DB::transaction(function () use ($bookingId, $now, &$cancelled) {
                    $booking = Booking::query()->lockForUpdate()->findOrFail($bookingId);

                    if (
                        $booking->payment_status !== PaymentStatus::Partial ||
                        ! in_array($booking->status, [BookingStatus::Pending, BookingStatus::Confirmed], true) ||
                        ! $booking->balance_due_at ||
                        $booking->balance_due_at->isAfter($now)
                    ) {
                        return;
                    }

                    $oldStatus = $booking->status;
                    $reason = 'Automatically cancelled because the remaining balance was not paid by the deadline. The down payment is non-refundable.';

                    $booking->forceFill([
                        'status' => BookingStatus::Cancelled,
                        'cancelled_at' => $now,
                        'admin_notes' => $reason,
                    ])->save();

                    $booking->statusLogs()->create([
                        'old_status' => $oldStatus,
                        'new_status' => BookingStatus::Cancelled,
                        'changed_by' => null,
                        'reason' => $reason,
                    ]);

                    $this->notificationService->createForBooking(
                        $booking,
                        'booking',
                        'Booking cancelled - unpaid balance',
                        "Booking {$booking->booking_code} was cancelled because the remaining balance was not paid on time. The captured down payment is non-refundable.",
                        [
                            'priority' => 'urgent',
                            'action_label' => 'View Booking',
                            'action' => 'view_booking',
                            'non_refundable' => true,
                        ]
                    );

                    $cancelled++;
                });
            });

        return compact('reminded', 'cancelled');
    }
}
