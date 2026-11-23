<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Models\Booking;
use App\Models\BookingFeedback;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class BookingFeedbackService
{
    public function store(Booking $booking, User $customer, array $values): BookingFeedback
    {
        return DB::transaction(function () use ($booking, $customer, $values) {
            $booking = Booking::query()->lockForUpdate()->findOrFail($booking->id);
            Gate::forUser($customer)->authorize('leaveFeedback', $booking);
            if ($booking->status !== BookingStatus::Completed) {
                throw ValidationException::withMessages(['rating' => 'Feedback is available after your rental is completed.']);
            }
            $rating = (int) $values['rating'];
            $comment = trim($values['comment'] ?? '');
            $comment = $comment === '' ? null : $comment;
            if ($existing = $booking->feedback()->first()) {
                // A retry after an interrupted response must not create or overwrite a review.
                abort_unless($existing->rating === $rating && $existing->comment === $comment, 409, 'Feedback has already been submitted for this booking.');

                return $existing;
            }

            return $booking->feedback()->create([
                'customer_id' => $customer->id, 'rating' => $rating, 'comment' => $comment,
            ]);
        });
    }

    public function forCustomer(User $customer): Builder
    {
        return BookingFeedback::query()->completed()->where('customer_id', $customer->id);
    }

    public function feature(BookingFeedback $feedback, User $actor, bool $featured): BookingFeedback
    {
        return DB::transaction(function () use ($feedback, $actor, $featured) {
            Booking::withTrashed()->whereKey($feedback->booking_id)->lockForUpdate()->firstOrFail();
            $feedback = BookingFeedback::query()->lockForUpdate()->findOrFail($feedback->id);
            Gate::forUser($actor)->authorize('feature', $feedback);
            if ($featured && ! BookingFeedback::query()->publishable()->whereKey($feedback->id)->exists()) {
                throw ValidationException::withMessages(['is_featured' => 'Only completed rental feedback with a written comment can be starred.']);
            }
            if ($feedback->is_featured !== $featured) {
                $feedback->update(['is_featured' => $featured, 'featured_by' => $featured ? $actor->id : null, 'featured_at' => $featured ? now() : null]);
            }

            return $feedback->load('booking.vehicle');
        });
    }
}
