<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\CustomerDocument;
use App\Models\User;
use App\Models\Vehicle;
use Carbon\CarbonImmutable;

class DashboardOverviewService
{
    public function forUser(User $user): array
    {
        $now = CarbonImmutable::now();
        $start = $now->setTimezone('Asia/Manila')->startOfDay()->utc();
        $end = $start->setTimezone('Asia/Manila')->endOfDay()->utc();
        $canBook = $user->can('manage bookings');
        $todayQuery = Booking::query()->blockingVehicleDates()
            ->whereDoesntHave('returnRecord', fn ($query) => $query->whereNotNull('vehicle_received_at'));
        $pickups = (clone $todayQuery)->where('status', 'confirmed')->whereBetween('rental_start_at', [$start, $end]);
        $returns = (clone $todayQuery)->whereBetween('rental_end_at', [$start, $end]);
        $operations = collect();

        if ($canBook) {
            foreach (['pickup' => $pickups, 'return' => $returns] as $kind => $query) {
                $column = $kind === 'pickup' ? 'rental_start_at' : 'rental_end_at';
                $operations = $operations->merge((clone $query)->with(['user:id,name', 'vehicle:id,name,plate_number', 'assignedDriver'])
                    ->orderBy($column)->limit(20)->get()->map(fn (Booking $booking) => [
                        'id' => $booking->id,
                        'kind' => $kind,
                        'at' => $booking->{$column}->toISOString(),
                        'bookingCode' => $booking->booking_code,
                        'customerName' => $booking->user?->name ?? 'Unknown',
                        'vehicleName' => $booking->vehicle?->name ?? 'Unknown',
                        'vehiclePlate' => $booking->vehicle?->plate_number,
                        'location' => $kind === 'pickup' ? $booking->pickup_location : $booking->return_location,
                        'driverName' => $booking->assignedDriver?->name,
                        'rentalType' => $booking->rental_type->value,
                    ]));
            }
        }

        // Customer charges already contribute to total_amount and remaining_balance.
        $balances = Booking::query()->whereIn('status', ['confirmed', 'ongoing', 'returned'])->where('remaining_balance', '>', 0);
        $pendingDocuments = $user->can('review documents')
            ? CustomerDocument::query()->whereIn('document_type', CustomerDocument::REQUIRED_SELF_DRIVE_DOCUMENTS)
                ->where('status', 'pending')->whereHas('user', fn ($query) => $query->role('customer'))->count()
            : null;

        return [
            'asOf' => $now->toISOString(),
            'today' => $start->setTimezone('Asia/Manila')->toDateString(),
            'todaysReturns' => (clone $returns)->count(),
            'operations' => $canBook ? $operations->sortBy('at')->take(20)->values()->all() : null,
            'operationsTotal' => $canBook ? (clone $pickups)->count() + (clone $returns)->count() : null,
            'pendingDocuments' => $pendingDocuments,
            'awaitingPayment' => $canBook ? Booking::where('status', 'pending')->count() : null,
            'balances' => $canBook ? [
                'amount' => (float) (clone $balances)->sum('remaining_balance'),
                'bookings' => (clone $balances)->count(),
                'overdueAmount' => (float) (clone $balances)->where('balance_due_at', '<', $now)->sum('remaining_balance'),
            ] : null,
            'fleet' => $user->can('manage vehicles') ? Vehicle::query()->selectRaw('status, count(*) as total')
                ->groupBy('status')->pluck('total', 'status')->map(fn ($total) => (int) $total)->all() : null,
            'maintenance' => $user->can('manage maintenance') ? app(MaintenanceService::class)->summary() : null,
        ];
    }
}
