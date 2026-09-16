<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\VehicleStatus;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\TelematicsEvent;
use App\Models\User;
use App\Models\Vehicle;
use App\Support\MaintenanceDueCalculator;
use App\Support\PublicStorageUrl;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

class ReportService
{
    public function dashboardSummary(): array
    {
        $bookings = Booking::all();
        $payments = Payment::where('status', 'completed')->get();

        return $this->summary(
            $bookings,
            $payments,
            Vehicle::count(),
            User::role('customer')->count()
        );
    }

    public function dashboardData(): array
    {
        $bookings = Booking::with(['user', 'vehicle'])
            ->latest()
            ->get();
        $payments = Payment::with(['booking.vehicle', 'user'])
            ->where('status', 'completed')
            ->latest()
            ->get();
        $vehicles = Vehicle::with([
            'images',
            'bookings.payments',
            'maintenancePlans',
            'currentCondition',
        ])->get();
        $periods = $this->monthPeriods(now()->toImmutable()->subMonthsNoOverflow(11)->startOfMonth());

        return [
            'summary' => $this->summary(
                $bookings,
                $payments,
                $vehicles->count(),
                User::role('customer')->count()
            ),
            'monthlyBookings' => $this->bookingPerformance($bookings, $periods),
            'monthlyRevenue' => $this->revenueTrend($payments, $periods),
            'fleetStatus' => $this->fleetStatus($vehicles),
            'topVehicles' => $this->topVehicles($vehicles),
            'confirmedBookings' => $bookings
                ->where('status', BookingStatus::Confirmed)
                ->take(5)
                ->map(fn (Booking $booking) => $this->bookingRow($booking))
                ->values()
                ->all(),
            'recentActivities' => $this->recentActivities($bookings, $payments),
        ];
    }

    public function analytics(string $range = '12_months'): array
    {
        $from = $this->rangeStart($range);
        $bookings = Booking::with(['user', 'vehicle', 'payments'])
            ->when($from, fn ($query) => $query->where('created_at', '>=', $from))
            ->latest()
            ->get();
        $payments = Payment::with(['booking.user', 'booking.vehicle'])
            ->where('status', 'completed')
            ->when($from, function ($query) use ($from) {
                $query->where(function ($query) use ($from) {
                    $query->where('completed_at', '>=', $from)
                        ->orWhere(function ($query) use ($from) {
                            $query->whereNull('completed_at')
                                ->where('created_at', '>=', $from);
                        });
                });
            })
            ->latest()
            ->get();
        $events = TelematicsEvent::with(['trip.booking', 'trip.booking.vehicle', 'trip.operator'])
            ->when($from, fn ($query) => $query->where('occurred_at', '>=', $from))
            ->latest('occurred_at')
            ->get();
        $vehicles = Vehicle::with([
            'maintenancePlans',
            'currentCondition',
            'bookings' => fn ($query) => $query
                ->when($from, fn ($query) => $query->where('created_at', '>=', $from))
                ->with(['payments', 'telematicsEvents']),
        ])->get();
        $customers = User::role('customer')
            ->with([
                'bookings' => fn ($query) => $query
                    ->when($from, fn ($query) => $query->where('created_at', '>=', $from))
                    ->with('payments'),
            ])
            ->get();
        $periods = $this->monthPeriods($this->periodStart($from, $bookings, $payments));
        $bookingPerformance = $this->bookingPerformance($bookings, $periods);
        $revenueTrend = $this->revenueTrend($payments, $periods);
        $fleet = $this->fleetRows($vehicles, $from);
        $customerRows = $this->customerRows($customers);
        $riskEvents = $events->map(fn (TelematicsEvent $event) => $this->riskRow($event))->values();
        $statusDistribution = collect(BookingStatus::cases())
            ->map(fn (BookingStatus $status) => [
                'name' => $status->adminLabel(),
                'value' => $bookings->where('status', $status)->count(),
                'color' => $this->bookingStatusColor($status),
            ])
            ->values();
        $cancelledCount = $bookings->where('status', BookingStatus::Cancelled)->count();
        $rejectedCount = $bookings->where('status', BookingStatus::Rejected)->count();
        $cancellationRate = $bookings->isEmpty()
            ? 0
            : round((($cancelledCount + $rejectedCount) / $bookings->count()) * 100, 1);

        return [
            'range' => $range,
            'summary' => $this->summary(
                $bookings,
                $payments,
                $vehicles->count(),
                $customers->count()
            ),
            'revenueTrend' => $revenueTrend,
            'bookingPerformance' => $bookingPerformance,
            'bookingStatusDistribution' => $statusDistribution,
            'revenueByRentalType' => $this->revenueByRentalType($payments),
            'revenueBreakdown' => [
                ['label' => 'Booked Subtotal', 'value' => (float) $bookings->sum('subtotal')],
                ['label' => 'Delivery Fees', 'value' => (float) $bookings->sum('delivery_fee')],
                ['label' => 'Add-ons', 'value' => (float) $bookings->sum('add_ons_total')],
                ['label' => 'Penalties & Late Fees', 'value' => (float) $bookings->sum(
                    fn (Booking $booking) => (float) $booking->penalty_total + (float) $booking->late_fee
                )],
            ],
            'revenueTransactions' => $payments
                ->take(100)
                ->map(fn (Payment $payment) => $this->paymentRow($payment))
                ->values(),
            'bookings' => $bookings
                ->take(100)
                ->map(fn (Booking $booking) => $this->bookingRow($booking))
                ->values(),
            'cancellation' => [
                'rate' => $cancellationRate,
                'cancelled' => $cancelledCount,
                'rejected' => $rejectedCount,
            ],
            'fleet' => $fleet,
            'fleetHighlights' => $this->fleetHighlights($fleet),
            'customers' => $customerRows,
            'newVsReturning' => $this->newVsReturning($bookings, $periods),
            'customerCancellationLeaders' => $customerRows
                ->filter(fn (array $customer) => $customer['cancelledBookings'] > 0)
                ->sortByDesc('cancelledBookings')
                ->take(4)
                ->values(),
            'riskEventCounts' => $events
                ->groupBy(fn (TelematicsEvent $event) => $event->event_type->label())
                ->map(fn (Collection $items, string $type) => [
                    'type' => $type,
                    'count' => $items->count(),
                ])
                ->sortByDesc('count')
                ->values(),
            'riskSummary' => $events
                ->groupBy(fn (TelematicsEvent $event) => $event->event_type->label())
                ->map(function (Collection $items, string $type) {
                    $severity = $items
                        ->sortByDesc(fn (TelematicsEvent $event) => $this->severityRank($event->severity))
                        ->first()
                        ?->severity ?? 'low';

                    return [
                        'label' => $type,
                        'count' => $items->count(),
                        'severity' => str($severity)->title()->toString(),
                    ];
                })
                ->sortByDesc('count')
                ->take(4)
                ->values(),
            'riskEvents' => $riskEvents->take(100)->values(),
            'highlights' => $this->highlights($fleet, $revenueTrend, $cancellationRate),
        ];
    }

    private function summary(
        Collection $bookings,
        Collection $payments,
        int $totalVehicles,
        int $totalCustomers
    ): array {
        return [
            'totalRevenue' => (float) $payments->sum('amount'),
            'totalVehicles' => $totalVehicles,
            'totalCustomers' => $totalCustomers,
            'totalBookings' => $bookings->count(),
            'completedBookings' => $bookings->where('status', BookingStatus::Completed)->count(),
            'activeRentals' => $bookings->where('status', BookingStatus::Ongoing)->count(),
            'confirmedBookings' => $bookings->where('status', BookingStatus::Confirmed)->count(),
            'pendingBookings' => $bookings->where('status', BookingStatus::Pending)->count(),
            'cancelledBookings' => $bookings->where('status', BookingStatus::Cancelled)->count(),
            'averageBookingDuration' => round((float) ($bookings->avg('duration_days') ?? 0), 1),
            'fleetStatus' => [
                'available' => Vehicle::where('status', VehicleStatus::Available->value)->count(),
                'rented' => Vehicle::where('status', VehicleStatus::Rented->value)->count(),
                'maintenance' => Vehicle::where('status', VehicleStatus::Maintenance->value)->count(),
                'unavailable' => Vehicle::where('status', VehicleStatus::Unavailable->value)->count(),
            ],
        ];
    }

    private function rangeStart(string $range): ?CarbonImmutable
    {
        return match ($range) {
            '6_months' => now()->toImmutable()->subMonthsNoOverflow(5)->startOfMonth(),
            'this_year' => now()->toImmutable()->startOfYear(),
            'all_time' => null,
            default => now()->toImmutable()->subMonthsNoOverflow(11)->startOfMonth(),
        };
    }

    private function periodStart(
        ?CarbonInterface $from,
        Collection $bookings,
        Collection $payments
    ): CarbonImmutable {
        if ($from) {
            return CarbonImmutable::parse($from)->startOfMonth();
        }

        $dates = $bookings->pluck('created_at')
            ->merge($payments->map(fn (Payment $payment) => $payment->paid_at ?? $payment->created_at))
            ->filter()
            ->map(fn ($date) => CarbonImmutable::parse($date));
        $earliest = $dates->sort()->first();
        $oldestAllowed = now()->toImmutable()->subMonthsNoOverflow(23)->startOfMonth();

        if (! $earliest) {
            return now()->toImmutable()->subMonthsNoOverflow(11)->startOfMonth();
        }

        $start = $earliest->startOfMonth();

        return $start->lessThan($oldestAllowed) ? $oldestAllowed : $start;
    }

    private function monthPeriods(CarbonInterface $from): Collection
    {
        $periods = collect();
        $cursor = CarbonImmutable::parse($from)->startOfMonth();
        $end = now()->toImmutable()->startOfMonth();

        while ($cursor->lessThanOrEqualTo($end)) {
            $periods->push([
                'key' => $cursor->format('Y-m'),
                'month' => $cursor->format('M Y'),
            ]);
            $cursor = $cursor->addMonth();
        }

        return $periods;
    }

    private function bookingPerformance(Collection $bookings, Collection $periods): array
    {
        return $periods->map(function (array $period) use ($bookings) {
            $monthBookings = $bookings->filter(
                fn (Booking $booking) => $booking->created_at?->format('Y-m') === $period['key']
            );

            return [
                'month' => $period['month'],
                'bookings' => $monthBookings->count(),
                'completed' => $monthBookings->where('status', BookingStatus::Completed)->count(),
            ];
        })->values()->all();
    }

    private function revenueTrend(Collection $payments, Collection $periods): array
    {
        return $periods->map(function (array $period) use ($payments) {
            $revenue = $payments
                ->filter(function (Payment $payment) use ($period) {
                    $date = $payment->paid_at ?? $payment->created_at;

                    return $date?->format('Y-m') === $period['key'];
                })
                ->sum('amount');

            return [
                'month' => $period['month'],
                'revenue' => (float) $revenue,
            ];
        })->values()->all();
    }

    private function fleetStatus(Collection $vehicles): array
    {
        return collect(VehicleStatus::cases())
            ->map(fn (VehicleStatus $status) => [
                'name' => $status->label(),
                'value' => $vehicles->where('status', $status)->count(),
                'color' => match ($status) {
                    VehicleStatus::Available => '#10B981',
                    VehicleStatus::Rented => '#346EF6',
                    VehicleStatus::Maintenance => '#F59E0B',
                    VehicleStatus::Unavailable => '#94A3B8',
                },
            ])
            ->values()
            ->all();
    }

    private function topVehicles(Collection $vehicles): array
    {
        return $vehicles
            ->map(function (Vehicle $vehicle) {
                $bookings = $vehicle->bookings;

                return [
                    'id' => (string) $vehicle->id,
                    'name' => $vehicle->name,
                    'bookings' => $bookings->count(),
                    'revenue' => (float) $bookings->sum(
                        fn (Booking $booking) => $booking->payments
                            ->whereIn('payment_status', [
                                PaymentStatus::Paid,
                                PaymentStatus::Partial,
                            ])
                            ->sum('amount')
                    ),
                    'status' => $vehicle->status->label(),
                    'image' => PublicStorageUrl::make($vehicle->images->first()?->image_path),
                ];
            })
            ->sortByDesc('bookings')
            ->take(3)
            ->values()
            ->all();
    }

    private function recentActivities(Collection $bookings, Collection $payments): array
    {
        $bookingActivities = $bookings->take(6)->map(fn (Booking $booking) => [
            'type' => 'booking',
            'label' => "Booking {$booking->booking_code} is {$booking->status->adminLabel()}.",
            'occurredAt' => $booking->updated_at?->toISOString(),
        ]);
        $paymentActivities = $payments->take(6)->map(fn (Payment $payment) => [
            'type' => 'payment',
            'label' => sprintf(
                'Payment PHP %s received for %s.',
                number_format((float) $payment->amount, 2),
                $payment->booking?->booking_code ?? 'a booking'
            ),
            'occurredAt' => ($payment->paid_at ?? $payment->created_at)?->toISOString(),
        ]);

        return $bookingActivities
            ->merge($paymentActivities)
            ->sortByDesc('occurredAt')
            ->take(8)
            ->values()
            ->all();
    }

    private function paymentRow(Payment $payment): array
    {
        return [
            'id' => $payment->id,
            'bookingId' => $payment->booking?->booking_code ?? 'N/A',
            'customer' => $payment->booking?->user?->name ?? $payment->user?->name ?? 'Unknown',
            'vehicle' => $payment->booking?->vehicle?->name ?? 'Unknown',
            'rentalType' => $payment->booking?->rental_type?->label() ?? 'N/A',
            'paymentMethod' => $payment->payment_method,
            'amount' => (float) $payment->amount,
            'paidDate' => ($payment->paid_at ?? $payment->created_at)?->format('M j, Y'),
            'status' => $payment->payment_status->label(),
        ];
    }

    private function bookingRow(Booking $booking): array
    {
        return [
            'internalId' => $booking->id,
            'bookingId' => $booking->booking_code,
            'customer' => $booking->user?->name ?? 'Unknown',
            'vehicle' => $booking->vehicle?->name ?? 'Unknown',
            'rentalDate' => $booking->rental_start_at?->format('M j, Y'),
            'returnDate' => $booking->rental_end_at?->format('M j, Y'),
            'totalCost' => (float) $booking->total_amount,
            'status' => $booking->status->adminLabel(),
            'statusKey' => $booking->status->value,
        ];
    }

    private function revenueByRentalType(Collection $payments): array
    {
        return $payments
            ->groupBy(fn (Payment $payment) => $payment->booking?->rental_type?->label() ?? 'Other')
            ->map(fn (Collection $items, string $type) => [
                'type' => $type,
                'value' => (float) $items->sum('amount'),
            ])
            ->values()
            ->all();
    }

    private function fleetRows(Collection $vehicles, ?CarbonInterface $from): Collection
    {
        $rangeStart = $from ? CarbonImmutable::parse($from) : null;
        $rangeDays = max(
            1,
            $rangeStart
                ? $rangeStart->startOfDay()->diffInDays(now()->endOfDay()) + 1
                : 365
        );

        return $vehicles->map(function (Vehicle $vehicle) use ($rangeDays) {
            $bookings = $vehicle->bookings;
            $bookedDays = $bookings
                ->whereNotIn('status', [BookingStatus::Cancelled, BookingStatus::Rejected])
                ->sum('duration_days');
            $incidentCount = $bookings->sum(
                fn (Booking $booking) => $booking->telematicsEvents
                    ->reject(fn (TelematicsEvent $event) => in_array($event->event_type->value, [
                        'start_trip',
                        'pause',
                        'resume',
                        'location',
                    ], true))
                    ->count()
            );

            return [
                'id' => (string) $vehicle->id,
                'vehicle' => $vehicle->name,
                'model' => $vehicle->model,
                'totalBookings' => $bookings->count(),
                'revenue' => (float) $bookings->sum(
                    fn (Booking $booking) => $booking->payments
                        ->whereIn('payment_status', [
                            PaymentStatus::Paid,
                            PaymentStatus::Partial,
                        ])
                        ->sum('amount')
                ),
                'utilization' => min(100, round(($bookedDays / $rangeDays) * 100, 1)),
                'maintenanceStatus' => $this->maintenanceStatus($vehicle),
                'incidents' => $incidentCount,
            ];
        })->sortByDesc('totalBookings')->values();
    }

    private function fleetHighlights(Collection $fleet): array
    {
        $mostBooked = $fleet->sortByDesc('totalBookings')->first();
        $leastBooked = $fleet->sortBy('totalBookings')->first();
        $maintenanceDue = $fleet
            ->whereIn('maintenanceStatus', ['Due', 'Critical'])
            ->count();

        return [
            [
                'label' => 'Most Booked',
                'value' => $mostBooked['vehicle'] ?? 'No data',
                'sub' => ($mostBooked['totalBookings'] ?? 0).' bookings',
            ],
            [
                'label' => 'Least Booked',
                'value' => $leastBooked['vehicle'] ?? 'No data',
                'sub' => ($leastBooked['totalBookings'] ?? 0).' bookings',
            ],
            [
                'label' => 'Maintenance Due',
                'value' => $maintenanceDue.' vehicles',
                'sub' => 'Due or overdue',
            ],
            [
                'label' => 'Fleet Size',
                'value' => (string) $fleet->count(),
                'sub' => 'Registered vehicles',
            ],
        ];
    }

    private function customerRows(Collection $customers): Collection
    {
        return $customers->map(function (User $customer) {
            $bookings = $customer->bookings;

            return [
                'id' => $customer->id,
                'name' => $customer->name,
                'email' => $customer->email,
                'totalBookings' => $bookings->count(),
                'completedBookings' => $bookings->where('status', BookingStatus::Completed)->count(),
                'cancelledBookings' => $bookings
                    ->whereIn('status', [BookingStatus::Cancelled, BookingStatus::Rejected])
                    ->count(),
                'totalSpent' => (float) $bookings->sum(
                    fn (Booking $booking) => $booking->payments
                        ->whereIn('payment_status', [
                            PaymentStatus::Paid,
                            PaymentStatus::Partial,
                        ])
                        ->sum('amount')
                ),
                'lastBookingDate' => $bookings
                    ->sortByDesc('created_at')
                    ->first()
                    ?->created_at
                    ?->format('M j, Y') ?? 'No bookings',
            ];
        })->sortByDesc('totalSpent')->values();
    }

    private function newVsReturning(Collection $bookings, Collection $periods): array
    {
        $firstBookingDates = Booking::query()
            ->selectRaw('user_id, MIN(created_at) as first_booking_at')
            ->groupBy('user_id')
            ->pluck('first_booking_at', 'user_id');

        return $periods->map(function (array $period) use ($bookings, $firstBookingDates) {
            $customerIds = $bookings
                ->filter(fn (Booking $booking) => $booking->created_at?->format('Y-m') === $period['key'])
                ->pluck('user_id')
                ->unique();
            $newCustomers = $customerIds->filter(function ($userId) use ($firstBookingDates, $period) {
                $firstBooking = $firstBookingDates->get($userId);

                return $firstBooking && CarbonImmutable::parse($firstBooking)->format('Y-m') === $period['key'];
            })->count();

            return [
                'month' => $period['month'],
                'new' => $newCustomers,
                'returning' => max(0, $customerIds->count() - $newCustomers),
            ];
        })->values()->all();
    }

    private function riskRow(TelematicsEvent $event): array
    {
        return [
            'eventId' => 'EV-'.str_pad((string) $event->id, 5, '0', STR_PAD_LEFT),
            'bookingId' => $event->trip?->booking?->booking_code ?? 'N/A',
            'vehicle' => $event->trip?->booking?->vehicle?->name ?? 'Unknown',
            'customer' => $event->trip?->operator?->name ?? 'Unknown',
            'eventType' => $event->event_type->label(),
            'location' => $event->latitude !== null && $event->longitude !== null
                ? $event->latitude.', '.$event->longitude
                : 'Not recorded',
            'timestamp' => $event->occurred_at?->format('M j, Y g:i A'),
            'severity' => str($event->severity)->title()->toString(),
        ];
    }

    private function maintenanceStatus(Vehicle $vehicle): string
    {
        $plans = $vehicle->relationLoaded('maintenancePlans')
            ? $vehicle->maintenancePlans->where('is_active', true)
            : $vehicle->maintenancePlans()->where('is_active', true)->get();

        if ($plans->isEmpty()) {
            return 'Good';
        }

        $statuses = $plans->map(fn ($plan) => app(MaintenanceDueCalculator::class)
            ->calculate($plan, $vehicle->currentCondition?->odometer)['status']->value);

        if ($statuses->contains('overdue')) {
            return 'Critical';
        }

        return $statuses->contains(fn (string $status) => in_array($status, ['due', 'due_soon'], true))
            ? 'Due' : 'Good';
    }

    private function bookingStatusColor(BookingStatus $status): string
    {
        return match ($status) {
            BookingStatus::Completed => '#10B981',
            BookingStatus::Ongoing => '#346EF6',
            BookingStatus::Returned => '#14B8A6',
            BookingStatus::Confirmed => '#60A5FA',
            BookingStatus::Pending => '#F59E0B',
            BookingStatus::Cancelled => '#F43F5E',
            BookingStatus::Rejected => '#A855F7',
        };
    }

    private function severityRank(string $severity): int
    {
        return match (strtolower($severity)) {
            'high', 'critical' => 3,
            'medium' => 2,
            default => 1,
        };
    }

    private function highlights(
        Collection $fleet,
        array $revenueTrend,
        float $cancellationRate
    ): array {
        $mostBooked = $fleet->sortByDesc('totalBookings')->first();
        $highestRevenueMonth = collect($revenueTrend)->sortByDesc('revenue')->first();
        $maintenanceDue = $fleet
            ->whereIn('maintenanceStatus', ['Due', 'Critical'])
            ->count();

        return [
            $mostBooked
                ? "{$mostBooked['vehicle']} leads with {$mostBooked['totalBookings']} bookings."
                : 'No vehicle booking data is available yet.',
            $highestRevenueMonth && $highestRevenueMonth['revenue'] > 0
                ? "{$highestRevenueMonth['month']} generated the highest received revenue at PHP ".number_format($highestRevenueMonth['revenue'], 2).'.'
                : 'No received revenue is available for this period.',
            "The cancellation and rejection rate is {$cancellationRate}%.",
            "{$maintenanceDue} vehicles are due or overdue for maintenance.",
        ];
    }
}
