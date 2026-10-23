<?php

namespace App\Services;

use App\Models\Booking;
use Illuminate\Database\Eloquent\Builder;

class BookingAttentionService
{
    public const LABELS = [
        'overdue_return' => 'Return Overdue',
        'not_started' => 'Not Started — Schedule Ended',
        'return_processing' => 'Return Processing Pending',
        'awaiting_settlement' => 'Awaiting Settlement',
        'ready_to_complete' => 'Ready to Complete',
    ];

    public function filter(Builder $query, string $attention): Builder
    {
        return match ($attention) {
            'overdue_return' => $query->where('status', 'ongoing')->where('rental_end_at', '<', now())
                ->whereDoesntHave('returnRecord', fn ($q) => $q->whereNotNull('vehicle_received_at')),
            'not_started' => $query->where('status', 'confirmed')->where('rental_end_at', '<', now()),
            'return_processing' => $query->where('status', 'ongoing')->whereHas('returnRecord', fn ($q) => $q->whereNotNull('vehicle_received_at')),
            'awaiting_settlement' => $query->where('status', 'returned')->where(function ($q) {
                $q->where('remaining_balance', '>', 0)->orWhereHas('additionalCharges', fn ($charges) => $charges->where('responsibility', 'customer')->outstanding());
            }),
            'ready_to_complete' => $query->where('status', 'returned')->where('remaining_balance', '<=', 0)
                ->whereDoesntHave('additionalCharges', fn ($charges) => $charges->where('responsibility', 'customer')->outstanding()),
            'all_attention' => $query->where(function ($q) {
                $q->where(function ($q) {
                    $q->whereIn('status', ['confirmed', 'ongoing'])->where('rental_end_at', '<', now());
                })->orWhere('status', 'returned')->orWhere(function ($q) {
                    $q->where('status', 'ongoing')->whereHas('returnRecord', fn ($record) => $record->whereNotNull('vehicle_received_at'));
                });
            }),
            default => $query,
        };
    }

    public function state(Booking $booking): ?array
    {
        $booking->loadMissing('returnRecord');
        $key = match (true) {
            $booking->status->value === 'ongoing' && $booking->returnRecord?->vehicle_received_at !== null => 'return_processing',
            $booking->status->value === 'ongoing' && $booking->rental_end_at?->isPast() => 'overdue_return',
            $booking->status->value === 'confirmed' && $booking->rental_end_at?->isPast() => 'not_started',
            $booking->status->value === 'returned' => (float) $booking->remaining_balance > 0 || ($booking->customer_charges_outstanding ?? $booking->additionalCharges()->where('responsibility', 'customer')->outstanding()->exists())
                ? 'awaiting_settlement' : 'ready_to_complete',
            default => null,
        };

        return $key ? ['key' => $key, 'label' => self::LABELS[$key]] : null;
    }

    public function upcomingBookings(Booking $booking): array
    {
        if ($booking->status->value !== 'ongoing') {
            return [];
        }

        $booking->loadMissing(['vehicle.upcomingConfirmedBookings', 'returnRecord']);

        return $booking->vehicle->upcomingConfirmedBookings
            ->filter(fn ($next) => $next->id !== $booking->id && $next->rental_start_at->gte($booking->rental_end_at)
                && $next->rental_start_at->lte(now()->addDay()->max($booking->returnRecord?->expected_return_at ?? now())))
            ->map(fn ($next) => ['id' => $next->id, 'bookingCode' => $next->booking_code, 'pickupAt' => $next->rental_start_at->toISOString()])->all();
    }

    public function counts(): array
    {
        $counts = [];
        foreach ([...array_keys(self::LABELS), 'all_attention'] as $key) {
            $counts[$key] = $this->filter(Booking::query(), $key)->count();
        }

        return $counts;
    }
}
