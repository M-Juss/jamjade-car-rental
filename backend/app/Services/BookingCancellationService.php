<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Models\Booking;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BookingCancellationService
{
    public function record(Booking $booking, string $kind, string $reason, ?User $actor): void
    {
        $booking->cancellation()->create([
            'kind' => $kind, 'reason' => $reason, 'recorded_by' => $actor?->id,
            'refund_amount' => in_array($kind, ['no_show', 'payment_deadline'], true) ? 0 : null,
        ]);
    }

    public function noShow(Booking $booking, User $actor, string $reason): Booking
    {
        abort_unless($actor->can('manage bookings'), 403);

        return DB::transaction(function () use ($booking, $actor, $reason) {
            $booking = Booking::query()->lockForUpdate()->findOrFail($booking->id);
            if ($booking->status !== BookingStatus::Confirmed || $booking->rental_end_at->isFuture() || $booking->started_at) {
                throw ValidationException::withMessages(['booking' => ['A no-show requires an unreleased confirmed booking whose entire rental period has ended.']]);
            }

            return app(BookingService::class)->transition($booking, BookingStatus::Cancelled, $actor, $reason, ['cancellation_kind' => 'no_show']);
        });
    }

    public function cancelWithRefund(Booking $booking, User $actor, array $data): Booking
    {
        abort_unless($actor->hasRole('admin') && $actor->can('manage bookings'), 403);

        return DB::transaction(function () use ($booking, $actor, $data) {
            $booking = Booking::query()->lockForUpdate()->findOrFail($booking->id);
            if ($booking->status !== BookingStatus::Confirmed) {
                throw ValidationException::withMessages(['booking' => ['Only a confirmed booking can be cancelled with a refund decision.']]);
            }
            $paid = round((float) $booking->successfulCustomerPayments()->sum('amount'), 2);
            $amount = $data['refund_mode'] === 'full' ? $paid : (float) $data['refund_amount'];
            if ($amount <= 0 || $amount > $paid || $amount > 9999999.99) {
                throw ValidationException::withMessages(['refund_amount' => ['Enter a refund greater than zero and no more than the amount actually paid.']]);
            }
            $booking = app(BookingService::class)->transition($booking, BookingStatus::Cancelled, $actor, $data['reason']);

            return $this->review($booking, $actor, ['amount' => $amount, 'reason' => $data['reason']]);
        });
    }

    public function review(Booking $booking, User $actor, array $data): Booking
    {
        abort_unless($actor->hasRole('admin') && $actor->can('manage bookings'), 403);

        return DB::transaction(function () use ($booking, $actor, $data) {
            $booking = Booking::query()->lockForUpdate()->findOrFail($booking->id);
            $cancellation = $booking->cancellation;
            if ($booking->status !== BookingStatus::Cancelled || ! $cancellation || ! in_array($cancellation->kind, ['customer', 'management'], true) || $cancellation->reviewed_at) {
                throw ValidationException::withMessages(['booking' => ['Only an unreviewed customer or management cancellation can receive a refund decision.']]);
            }
            $paidCents = (int) round((float) $booking->successfulCustomerPayments()->sum('amount') * 100);
            $refundCents = (int) round((float) $data['amount'] * 100);
            if ($refundCents > $paidCents) {
                throw ValidationException::withMessages(['amount' => ['The refund cannot exceed completed customer payments.']]);
            }
            $cancellation->update([
                'refund_amount' => $data['amount'], 'refund_reason' => $data['reason'],
                'reviewed_by' => $actor->id, 'reviewed_at' => now(),
            ]);
            $booking->events()->create(['event_type' => 'refund_reviewed', 'actor_user_id' => $actor->id]);
            activity()->causedBy($actor)->performedOn($booking)->event('booking_refund_reviewed')
                ->withProperties(['amount' => $data['amount']])->log('Cancellation refund reviewed.');

            return $booking->fresh();
        });
    }

    public function recordRefund(Booking $booking, User $actor): Booking
    {
        abort_unless($actor->hasRole('admin') && $actor->can('manage bookings'), 403);

        return DB::transaction(function () use ($booking, $actor) {
            $booking = Booking::query()->lockForUpdate()->findOrFail($booking->id);
            $cancellation = $booking->cancellation;
            if ($booking->status !== BookingStatus::Cancelled || ! $cancellation?->reviewed_at || (float) $cancellation->refund_amount <= 0) {
                throw ValidationException::withMessages(['booking' => ['Approve a positive cancellation refund before recording money returned.']]);
            }
            if ($cancellation->refunded_at) {
                return $booking;
            }
            $cancellation->update(['refunded_at' => now(), 'refunded_by' => $actor->id]);
            $booking->events()->create(['event_type' => 'refund_recorded', 'actor_user_id' => $actor->id]);
            activity()->causedBy($actor)->performedOn($booking)->event('booking_refund_recorded')
                ->withProperties(['amount' => (float) $cancellation->refund_amount])->log('External cancellation refund recorded.');
            app(NotificationService::class)->createForBooking($booking, 'payment', 'Refund recorded',
                'Jamjade recorded a refund of PHP '.number_format((float) $cancellation->refund_amount, 2).' for booking '.$booking->booking_code.'.');

            return $booking->fresh();
        });
    }
}
