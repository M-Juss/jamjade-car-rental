<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Support\ReportPeriod;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\LazyCollection;

class ReportAnalyticsService
{
    public const SECTIONS = ['overview', 'revenue', 'bookings', 'fleet', 'customers', 'telematics'];

    public const PAGE_SIZE = 10;

    private const RENTAL_TYPES = ['self_drive' => 'Self Drive', 'owners_driver' => 'With Assigned Driver'];

    public function operatorsNeedingAttention(ReportPeriod $period, array $filters): LengthAwarePaginator
    {
        $overview = app(RentalDrivingOverviewService::class);
        $scope = $this->bookingQuery($filters, includeOperator: true)->select('bookings.id');
        $rentals = $overview->rentals(['graded_only' => true])->whereIn('booking.id', $scope)->whereNotNull('trip.operator_user_id');
        $period->constrain($rentals, 'completion.completed_at');

        return $overview->operators($rentals, self::PAGE_SIZE, RentalDrivingOverviewService::ATTENTION_GRADE_THRESHOLD,
            'operator_page', $filters['operator_page'] ?? 1);
    }

    public function analytics(string $section, ReportPeriod $period, array $filters): array
    {
        $dataset = $this->dataset($section, $period, $filters);
        $table = $section === 'overview' || $dataset['table'] === null
            ? null
            : $this->page($dataset['table'], $filters['page'] ?? 1, $filters['per_page'] ?? self::PAGE_SIZE);

        return [
            'section' => $section,
            'period' => $period->description(),
            'vehicles' => DB::table('vehicles')->orderBy('name')->orderBy('id')->get(['id', 'name', 'plate_number'])
                ->map(fn (object $vehicle) => ['id' => (int) $vehicle->id, 'name' => $this->vehicleLabel($vehicle->name, $vehicle->plate_number)])->all(),
            'metrics' => $dataset['metrics'],
            'charts' => $dataset['charts'],
            'table' => $table,
        ];
    }

    public function export(string $section, ReportPeriod $period, array $filters): array
    {
        $table = match ($section) {
            'revenue' => $this->revenueTable($this->cashEntries($period, $filters)),
            'bookings' => $this->bookingTable($this->finalBookings($period, $filters)),
            'telematics' => $this->maneuverExport($period, $filters),
            default => $this->dataset($section, $period, $filters)['table'],
        };

        return $this->exportTable($table);
    }

    public function exportSection(string $section, ReportPeriod $period, array $filters): array
    {
        $dataset = $this->dataset($section, $period, $filters);

        return [
            'metrics' => $dataset['metrics'],
            'charts' => $dataset['charts'],
            'records' => $dataset['table'] === null ? null : $this->exportTable($dataset['table']),
        ];
    }

    private function exportTable(array $table): array
    {
        return [
            'title' => $table['title'],
            'columns' => $table['columns'],
            'rows' => $this->tableRows($table, $table['rows'] instanceof Builder ? $table['rows']->cursor() : $table['rows']->lazy()),
        ];
    }

    private function dataset(string $section, ReportPeriod $period, array $filters): array
    {
        return match ($section) {
            'overview' => $this->overview($period, $filters),
            'revenue' => $this->revenue($period, $filters),
            'bookings' => $this->bookings($period, $filters),
            'fleet' => $this->fleet($period, $filters),
            'customers' => $this->customers($period, $filters),
            'telematics' => $this->telematics($period, $filters),
        };
    }

    private function overview(ReportPeriod $period, array $filters): array
    {
        $cash = $this->cashTotals($this->cashEntries($period, $filters), $period);
        $points = $period->points(['completed' => 0, 'self_drive' => 0, 'owners_driver' => 0, 'cancelled' => 0, 'customers' => 0]);
        $customers = [];
        $bucketCustomers = [];
        $vehicles = [];
        $completed = 0;
        $cancelled = 0;
        $finals = $this->finalBookings($period, $filters)
            ->addSelect('bookings.user_id', 'bookings.vehicle_id', 'vehicles.plate_number');
        foreach ($finals->cursor() as $booking) {
            $bucket = $period->bucket($booking->occurred_at);
            if ($booking->outcome === 'cancelled') {
                $points[$bucket]['cancelled']++;
                $cancelled++;
            }
            if ($booking->outcome !== 'completed') {
                continue;
            }
            $completed++;
            $points[$bucket]['completed']++;
            $points[$bucket][$booking->rental_type]++;
            $customers[$booking->user_id] = true;
            if (! isset($bucketCustomers[$bucket][$booking->user_id])) {
                $points[$bucket]['customers']++;
                $bucketCustomers[$bucket][$booking->user_id] = true;
            }
            $vehicles[$booking->vehicle_id] ??= [
                'id' => $booking->vehicle_id,
                'label' => $booking->vehicle === null ? 'Not recorded' : $this->vehicleLabel($booking->vehicle, $booking->plate_number),
                'completed' => 0,
            ];
            $vehicles[$booking->vehicle_id]['completed']++;
        }
        $ranking = collect($vehicles)->sortBy([['completed', 'desc'], ['label', 'asc'], ['id', 'asc']])->take(5)
            ->map(fn (array $vehicle) => ['label' => $vehicle['label'], 'completed' => $vehicle['completed']])->values()->all();
        $rows = collect($cash['points'])->map(fn (array $point, string $key) => [
            ...$point,
            ...$points[$key],
        ])->values();

        return [
            'metrics' => [
                $this->metric('Net receipts', $cash['net'], 'money'),
                $this->metric('Rentals completed', $completed),
                $this->metric('Customers served', count($customers)),
                $this->metric('Cancellations', $cancelled),
            ],
            'charts' => [
                $this->chart('Receipts over time', 'line', 'money', ['net' => 'Net receipts'], $cash['points']),
                $this->chart('Most booked vehicles', 'horizontal', 'count', ['completed' => 'Completed rentals'], $ranking),
            ],
            'table' => $this->table('Period totals', [
                'label' => ['Period', 'text'],
                'gross' => ['Gross receipts', 'money'],
                'refunds' => ['Refunds paid', 'money'],
                'net' => ['Net receipts', 'money'],
                'completed' => ['Rentals completed', 'count'],
                'self_drive' => ['Self Drive', 'count'],
                'owners_driver' => ['Assigned Driver', 'count'],
                'customers' => ['Customers served', 'count'],
                'cancelled' => ['Cancellations', 'count'],
            ], $rows),
        ];
    }

    private function revenue(ReportPeriod $period, array $filters): array
    {
        $entries = $this->cashEntries($period, $filters);
        $cash = $this->cashTotals($entries, $period);
        $payments = 0;
        $bookings = [];
        $purposes = [];
        $vehicles = [];
        foreach ((clone $entries)->cursor() as $entry) {
            $cents = (int) round((float) $entry->amount * 100);
            $vehicles[$entry->vehicle_id] ??= [
                'id' => $entry->vehicle_id, 'net' => 0,
                'label' => $entry->vehicle === null ? 'Not recorded' : $this->vehicleLabel($entry->vehicle, $entry->plate_number),
            ];
            $vehicles[$entry->vehicle_id]['net'] += $cents;
            if ($entry->entry_type !== 'Receipt') {
                continue;
            }
            $payments++;
            $bookings[$entry->booking_id] = true;
            $purpose = $this->paymentPurposeLabel($entry->purpose);
            $purposes[$purpose] = ($purposes[$purpose] ?? 0) + $cents;
        }
        $byPurpose = collect($purposes)->map(fn (int $cents, string $label) => ['label' => $label, 'gross' => $cents / 100])
            ->sortBy([['gross', 'desc'], ['label', 'asc']])->values()->all();
        $ranked = collect($vehicles)->sortBy([['net', 'desc'], ['label', 'asc'], ['id', 'asc']])->values();
        $byVehicle = $ranked->take(5)->map(fn (array $vehicle) => ['label' => $vehicle['label'], 'net' => $vehicle['net'] / 100])->values()->all();
        if ($ranked->count() > 5) {
            $byVehicle[] = ['label' => 'Other vehicles', 'net' => $ranked->slice(5)->sum('net') / 100];
        }

        return [
            'metrics' => [
                [...$this->metric('Net receipts', $cash['net'], 'money'), 'details' => [
                    $this->metric('Gross receipts', $cash['gross'], 'money'),
                    $this->metric('Refunds paid', $cash['refunds'], 'money'),
                ]],
                $this->metric('Payments received', $payments),
                $this->metric('Bookings with payments', count($bookings)),
                $this->metric('Average payment', $payments === 0 ? null : round($cash['gross'] / $payments, 2), 'money'),
            ],
            'charts' => [
                $this->chart('Receipts by payment purpose', 'horizontal', 'money', ['gross' => 'Gross receipts'], $byPurpose),
                $this->chart('Net receipts by vehicle', 'horizontal', 'money', ['net' => 'Net receipts'], $byVehicle),
            ],
            'table' => $this->revenueTable($entries),
        ];
    }

    private function paymentPurposeLabel(?string $purpose): string
    {
        return match ($purpose) {
            'full_payment' => 'Full payments',
            'down_payment' => 'Down payments',
            'remaining_balance' => 'Balance payments',
            'customer_outstanding' => 'Customer charges',
            'driver_outstanding' => 'Driver charges',
            'manual_booking_payment' => 'Manual payments',
            default => 'Other payments',
        };
    }

    private function cashEntries(ReportPeriod $period, array $filters): Builder
    {
        $payments = $this->bookingQuery($filters, historical: true)
            ->join('payments', 'payments.booking_id', '=', 'bookings.id')
            ->leftJoin('vehicles', 'vehicles.id', '=', 'bookings.vehicle_id')
            ->where('payments.status', 'completed')
            ->where('payments.currency', 'PHP')
            ->where('payments.amount', '>', 0)
            ->where(function (Builder $query) use ($period) {
                $period->constrain($query, 'payments.completed_at')
                    ->orWhere(fn (Builder $legacy) => $period->constrain($legacy->whereNull('payments.completed_at'), 'payments.created_at'));
            })
            ->selectRaw("payments.id as entry_id, coalesce(payments.completed_at, payments.created_at) as occurred_at,
                'Receipt' as entry_type, payments.provider as method, payments.amount as amount,
                bookings.id as booking_id, bookings.vehicle_id, payments.purpose, vehicles.plate_number,
                bookings.booking_code as booking, bookings.rental_type, vehicles.name as vehicle");

        $refunds = $this->bookingQuery($filters, historical: true)
            ->join('booking_cancellations as refund', 'refund.booking_id', '=', 'bookings.id')
            ->leftJoin('vehicles', 'vehicles.id', '=', 'bookings.vehicle_id')
            ->where('refund.refund_amount', '>', 0)
            ->selectRaw("refund.id as entry_id, refund.refunded_at as occurred_at,
                'Refund' as entry_type, null as method, -refund.refund_amount as amount,
                bookings.id as booking_id, bookings.vehicle_id, null as purpose, vehicles.plate_number,
                bookings.booking_code as booking, bookings.rental_type, vehicles.name as vehicle");

        return DB::query()->fromSub($payments->unionAll($period->constrain($refunds, 'refund.refunded_at')), 'cash_entries');
    }

    private function cashTotals(Builder $entries, ReportPeriod $period): array
    {
        $points = $period->points(['gross' => 0, 'refunds' => 0, 'net' => 0]);
        $gross = 0;
        $refunds = 0;

        foreach ((clone $entries)->select(['occurred_at', 'entry_type', 'amount', 'rental_type'])->cursor() as $entry) {
            $key = $period->bucket($entry->occurred_at);
            $cents = (int) round((float) $entry->amount * 100);
            if ($entry->entry_type === 'Receipt') {
                $points[$key]['gross'] += $cents;
                $gross += $cents;
            } else {
                $points[$key]['refunds'] -= $cents;
                $refunds -= $cents;
            }
            $points[$key]['net'] += $cents;
        }

        return [
            'points' => array_map(fn (array $point) => [
                ...$point, 'gross' => $point['gross'] / 100, 'refunds' => $point['refunds'] / 100, 'net' => $point['net'] / 100,
            ], $points),
            'gross' => $gross / 100,
            'refunds' => $refunds / 100,
            'net' => ($gross - $refunds) / 100,
        ];
    }

    private function revenueTable(Builder $query): array
    {
        return $this->table('Transactions', [
            'occurred_at' => ['Date', 'datetime'],
            'entry_type' => ['Transaction', 'text'],
            'booking' => ['Booking', 'text'],
            'vehicle' => ['Vehicle', 'text'],
            'rental_type' => ['Rental type', 'text'],
            'method' => ['Method', 'text'],
            'purpose' => ['Purpose', 'text'],
            'amount' => ['Amount', 'money'],
        ], $query->orderByDesc('occurred_at')->orderBy('entry_type')->orderByDesc('entry_id'));
    }

    private function bookings(ReportPeriod $period, array $filters): array
    {
        $events = $this->bookingActivity($period, $filters);
        $activity = $this->bookingTotals($events, $period);

        return [
            'metrics' => [
                $this->metric('Bookings created', $activity['totals']['created']),
                $this->metric('Rentals completed', $activity['totals']['completed']),
                $this->metric('Cancellations', $activity['totals']['cancelled']),
                $this->metric('No-shows', $activity['totals']['no_show']),
                $this->metric('Rejected', $activity['totals']['rejected']),
            ],
            'charts' => [
                $this->chart('Bookings by rental type', 'stacked', 'count', self::RENTAL_TYPES, $activity['points']),
                $this->chart('Booking outcomes', 'bar', 'count', ['completed' => 'Completed', 'cancelled' => 'Cancelled', 'no_show' => 'No-show', 'rejected' => 'Rejected'], $activity['points']),
            ],
            'table' => $this->bookingTable($this->finalBookings($period, $filters)),
        ];
    }

    private function bookingActivity(ReportPeriod $period, array $filters): Builder
    {
        $booking = $this->bookingQuery($filters)
            ->leftJoin('vehicles', 'vehicles.id', '=', 'bookings.vehicle_id')
            ->selectRaw('bookings.booking_code as booking, bookings.rental_type, vehicles.name as vehicle');
        $created = $period->constrain((clone $booking), 'bookings.created_at')
            ->selectRaw("bookings.id as entry_id, bookings.created_at as occurred_at, 'created' as outcome");
        $outcomes = $period->constrain((clone $booking)->join('booking_events as event', 'event.booking_id', '=', 'bookings.id'), 'event.created_at')
            ->leftJoin('booking_cancellations as cancellation', 'cancellation.booking_id', '=', 'bookings.id')
            ->where('event.event_type', 'status_changed')
            ->whereIn('event.new_status', ['completed', 'cancelled', 'rejected', 'no_show'])
            ->selectRaw("event.id as entry_id, event.created_at as occurred_at,
                case when event.new_status = 'cancelled' and cancellation.kind = 'no_show' then 'no_show' else event.new_status end as outcome");

        return DB::query()->fromSub($created->unionAll($outcomes), 'booking_activity');
    }

    private function bookingTotals(Builder $events, ReportPeriod $period): array
    {
        $totals = ['created' => 0, 'completed' => 0, 'cancelled' => 0, 'no_show' => 0, 'rejected' => 0];
        $points = $period->points([...$totals, 'self_drive' => 0, 'owners_driver' => 0]);

        foreach ((clone $events)->select(['occurred_at', 'outcome', 'rental_type'])->cursor() as $entry) {
            $key = $period->bucket($entry->occurred_at);
            $points[$key][$entry->outcome]++;
            $totals[$entry->outcome]++;
            if ($entry->outcome === 'created') {
                $points[$key][$entry->rental_type]++;
            }
        }

        return ['totals' => $totals, 'points' => $points];
    }

    private function bookingTable(Builder $query): array
    {
        return $this->table('Booking outcomes', [
            'occurred_at' => ['Date', 'datetime'],
            'booking' => ['Booking', 'text'],
            'vehicle' => ['Vehicle', 'text'],
            'rental_type' => ['Rental type', 'text'],
            'outcome' => ['Status', 'text'],
        ], $query->orderByDesc('occurred_at')->orderBy('outcome')->orderByDesc('entry_id'));
    }

    private function finalBookings(ReportPeriod $period, array $filters): Builder
    {
        $finalStatuses = DB::table('booking_events')->where('event_type', 'status_changed')
            ->whereIn('new_status', BookingStatus::terminalValues())
            ->groupBy('booking_id', 'new_status')->selectRaw('booking_id, new_status, max(created_at) as occurred_at');
        $bookings = $this->bookingQuery($filters)->whereIn('bookings.status', BookingStatus::terminalValues())
            ->joinSub($finalStatuses, 'final_status', fn ($join) => $join->on('final_status.booking_id', '=', 'bookings.id')
                ->on('final_status.new_status', '=', 'bookings.status'))
            ->leftJoin('vehicles', 'vehicles.id', '=', 'bookings.vehicle_id')
            ->leftJoin('booking_cancellations as cancellation', 'cancellation.booking_id', '=', 'bookings.id')
            ->selectRaw("bookings.id as entry_id, final_status.occurred_at, bookings.booking_code as booking,
                bookings.rental_type, vehicles.name as vehicle,
                case when bookings.status = 'cancelled' and cancellation.kind = 'no_show' then 'no_show' else bookings.status end as outcome");

        return $period->constrain($bookings, 'final_status.occurred_at');
    }

    private function fleet(ReportPeriod $period, array $filters): array
    {
        $returns = $this->bookingQuery($filters)->join('booking_returns as receipt', 'receipt.booking_id', '=', 'bookings.id');
        $durations = (clone $returns)->joinSub($this->lifecycle(BookingStatus::Ongoing), 'release', 'release.booking_id', '=', 'bookings.id')
            ->where('release.occurred_at', '<', $period->dataEnd->utc())
            ->where('receipt.vehicle_received_at', '>', $period->start->utc())
            ->whereColumn('receipt.vehicle_received_at', '>', 'release.occurred_at')
            ->select(['bookings.vehicle_id', 'release.occurred_at as released_at', 'receipt.vehicle_received_at']);
        $late = $period->constrain((clone $returns), 'receipt.vehicle_received_at')
            ->whereColumn('receipt.vehicle_received_at', '>', 'bookings.rental_end_at')
            ->groupBy('bookings.vehicle_id')->selectRaw('bookings.vehicle_id, count(*) as total')->pluck('total', 'vehicle_id');
        $includeMaintenance = ! isset($filters['rental_type']);
        $search = $this->searchPattern($filters);
        $maintenance = $includeMaintenance
            ? $period->constrain(DB::table('vehicle_maintenance_records')->where('status', 'completed'), 'completed_at')
                ->when(isset($filters['vehicle_id']), fn (Builder $query) => $query->where('vehicle_id', $filters['vehicle_id']))
                ->when($search, fn (Builder $query, string $pattern) => $query
                    ->whereExists($this->matchingVehicle('vehicle_maintenance_records.vehicle_id', $pattern)))
                ->groupBy('vehicle_id')->selectRaw('vehicle_id, count(*) as total')->pluck('total', 'vehicle_id')
            : collect();

        $seconds = [];
        foreach ($durations->cursor() as $rental) {
            $start = max(CarbonImmutable::parse($rental->released_at, 'UTC')->timestamp, $period->start->timestamp);
            $end = min(CarbonImmutable::parse($rental->vehicle_received_at, 'UTC')->timestamp, $period->dataEnd->timestamp);
            $seconds[$rental->vehicle_id] = ($seconds[$rental->vehicle_id] ?? 0) + ($end - $start);
        }

        $vehicleIds = collect(array_keys($seconds))->merge($late->keys())->merge($maintenance->keys())->unique();
        $rows = DB::table('vehicles')->whereIn('id', $vehicleIds)->get(['id', 'name', 'plate_number'])
            ->map(fn (object $vehicle) => [
                'vehicle' => $this->vehicleLabel($vehicle->name, $vehicle->plate_number),
                'rented' => isset($seconds[$vehicle->id]) ? round($seconds[$vehicle->id] / 3600, 2) : null,
                'late' => (int) $late->get($vehicle->id, 0),
                'maintenance' => (int) $maintenance->get($vehicle->id, 0),
            ])->sortBy([['rented', 'desc'], ['vehicle', 'asc']])->values();
        $ranking = $rows->whereNotNull('rented')->take(5)->map(fn (array $row) => ['label' => $row['vehicle'], 'hours' => $row['rented']]);
        $metrics = [
            $this->metric('Hours rented', $seconds === [] ? null : round(array_sum($seconds) / 3600, 2), 'hours'),
            $this->metric('Late returns', (int) $late->sum()),
        ];
        $columns = ['vehicle' => ['Vehicle', 'text'], 'rented' => ['Hours rented', 'hours'], 'late' => ['Late returns', 'count']];
        if ($includeMaintenance) {
            $metrics[] = $this->metric('Maintenance completed', (int) $maintenance->sum());
            $columns['maintenance'] = ['Maintenance completed', 'count'];
        }

        return [
            'metrics' => $metrics,
            'charts' => [$this->chart('Most rented vehicles', 'horizontal', 'hours', ['hours' => 'Hours rented'], $ranking->all())],
            'table' => $this->table('Vehicles', $columns, $rows),
        ];
    }

    private function customers(ReportPeriod $period, array $filters): array
    {
        $completions = $this->lifecycle(BookingStatus::Completed);
        // Ratings deliberately ignore report dates, filters and publication choices.
        $ratings = DB::table('booking_feedback as feedback')
            ->join('bookings as rated_booking', 'rated_booking.id', '=', 'feedback.booking_id')
            ->whereNull('rated_booking.deleted_at')->where('rated_booking.status', BookingStatus::Completed->value)
            ->groupBy('feedback.customer_id')->selectRaw('feedback.customer_id, avg(feedback.rating) as lifetime_rating, count(*) as rating_count');
        // Include earlier down payments, but never cash recorded after the report cutoff.
        $payments = DB::table('payments')->where('status', 'completed')->where('currency', 'PHP')->where('amount', '>', 0)
            ->where(fn (Builder $query) => $query->whereNull('purpose')->orWhere('purpose', '!=', 'driver_outstanding'))
            ->whereRaw('coalesce(completed_at, created_at) < ?', [$period->dataEnd->utc()])
            ->groupBy('booking_id', 'user_id')->selectRaw('booking_id, user_id, sum(amount) as paid');
        $refunds = DB::table('booking_cancellations')->where('refund_amount', '>', 0)
            ->where('refunded_at', '<', $period->dataEnd->utc())
            ->groupBy('booking_id')->selectRaw('booking_id, sum(refund_amount) as refunded');
        $firstRental = DB::query()->fromSub(clone $completions, 'first_completion')
            ->join('bookings', 'bookings.id', '=', 'first_completion.booking_id')
            ->whereNull('bookings.deleted_at')
            ->groupBy('bookings.user_id')->selectRaw('bookings.user_id, min(first_completion.occurred_at) as first_completed');
        $rentals = $this->bookingQuery($filters)->joinSub($completions, 'completion', 'completion.booking_id', '=', 'bookings.id')
            ->joinSub($firstRental, 'history', 'history.user_id', '=', 'bookings.user_id')
            ->leftJoin('users', 'users.id', '=', 'bookings.user_id')
            ->leftJoin('vehicles', 'vehicles.id', '=', 'bookings.vehicle_id')
            ->leftJoinSub($ratings, 'ratings', 'ratings.customer_id', '=', 'bookings.user_id')
            ->leftJoinSub($payments, 'customer_payments', fn ($join) => $join->on('customer_payments.booking_id', '=', 'bookings.id')
                ->on('customer_payments.user_id', '=', 'bookings.user_id'))
            ->leftJoinSub($refunds, 'customer_refunds', 'customer_refunds.booking_id', '=', 'bookings.id')
            ->select(['bookings.user_id', 'bookings.vehicle_id', 'bookings.rental_type', 'users.name as customer', 'ratings.lifetime_rating', 'ratings.rating_count',
                'vehicles.name as vehicle_name', 'vehicles.plate_number', 'completion.occurred_at', 'history.first_completed'])
            ->selectRaw('coalesce(customer_payments.paid, 0) as paid, coalesce(customer_refunds.refunded, 0) as refunded');
        $points = $period->points(['firstTime' => 0, 'returning' => 0]);
        $rows = [];
        $seen = [];
        $vehicles = [];

        foreach ($period->constrain($rentals, 'completion.occurred_at')->orderBy('completion.occurred_at')->orderBy('bookings.id')->cursor() as $rental) {
            $bucket = $period->bucket($rental->occurred_at);
            if (! isset($seen[$bucket][$rental->user_id])) {
                $group = $period->bucket($rental->first_completed) === $bucket ? 'firstTime' : 'returning';
                $points[$bucket][$group]++;
                $seen[$bucket][$rental->user_id] = true;
            }
            $rows[$rental->user_id] ??= [
                'customer' => $rental->customer,
                'customer_id' => $rental->user_id,
                'lifetime_rating' => $rental->lifetime_rating,
                'rating_count' => (int) $rental->rating_count,
                'completed' => 0,
                'self_drive' => 0,
                'owners_driver' => 0,
                'spent_cents' => 0,
                'last_completed' => null,
            ];
            $rows[$rental->user_id]['completed']++;
            $rows[$rental->user_id][$rental->rental_type]++;
            $rows[$rental->user_id]['spent_cents'] += (int) round((float) $rental->paid * 100) - (int) round((float) $rental->refunded * 100);
            $rows[$rental->user_id]['last_completed'] = $rental->occurred_at;
            $vehicles[$rental->user_id][$rental->vehicle_id] ??= [
                'id' => $rental->vehicle_id, 'count' => 0,
                'label' => $rental->vehicle_name === null ? null : $this->vehicleLabel($rental->vehicle_name, $rental->plate_number),
                'last_completed' => null,
            ];
            $vehicles[$rental->user_id][$rental->vehicle_id]['count']++;
            $vehicles[$rental->user_id][$rental->vehicle_id]['last_completed'] = $rental->occurred_at;
        }

        $customers = collect($rows)->map(function (array $row, int $customerId) use ($vehicles) {
            $favorite = collect($vehicles[$customerId])->sortBy([['count', 'desc'], ['last_completed', 'desc'], ['id', 'asc']])->first();

            return [...$row, 'total_spent' => $row['spent_cents'] / 100, 'most_booked_vehicle' => $favorite['label']];
        })->sortBy([['completed', 'desc'], ['customer', 'asc']])->values();

        return [
            'metrics' => [$this->metric('Customers', $customers->count()),
                $this->metric('Self Drive completed', (int) $customers->sum('self_drive')),
                $this->metric('Assigned Driver completed', (int) $customers->sum('owners_driver')),
                $this->metric('Total spent', $customers->sum('spent_cents') / 100, 'money')],
            'charts' => [$this->chart('First-time and returning customers', 'stacked', 'count', ['firstTime' => 'First-time', 'returning' => 'Returning'], $points)],
            'table' => $this->table('Customers', [
                'customer' => ['Customer', 'text'],
                'self_drive' => ['Self Drive', 'count'],
                'owners_driver' => ['Assigned Driver', 'count'],
                'total_spent' => ['Total spent', 'money'],
                'most_booked_vehicle' => ['Most booked vehicle', 'text'],
                'last_completed' => ['Last completed rental', 'datetime'],
                'lifetime_rating' => ['Lifetime ratings', 'rating'],
            ], $customers),
        ];
    }

    private function telematics(ReportPeriod $period, array $filters): array
    {
        return [
            'metrics' => $this->maneuverMetrics($period, $filters),
            'charts' => [],
            'table' => null,
        ];
    }

    private function maneuverMetrics(ReportPeriod $period, array $filters): array
    {
        $scope = $this->bookingQuery($filters, includeOperator: true)->select('bookings.id');
        $rentals = app(RentalDrivingOverviewService::class)->rentals()
            ->whereIn('booking.id', $scope)->whereNotNull('report.id');
        $period->constrain($rentals, 'completion.completed_at');
        $labels = [
            'harsh_acceleration' => 'Harsh acceleration',
            'harsh_braking' => 'Harsh braking',
            'harsh_cornering' => 'Harsh cornering',
            'harsh_swerve' => 'Harsh swerving',
        ];
        $rentals->select(array_map(fn ($key) => "report.snapshot->maneuvers->{$key} as {$key}", array_keys($labels)));
        $totals = DB::query()->fromSub($rentals, 'maneuvers')->selectRaw(implode(', ',
            array_map(fn ($key) => "COALESCE(SUM({$key}), 0) as {$key}", array_keys($labels))))->first();

        return collect($labels)->map(fn ($label, $key) => $this->metric($label, (int) $totals->$key))->values()->all();
    }

    private function maneuverExport(ReportPeriod $period, array $filters): array
    {
        return $this->table('Harsh maneuvers', [
            'label' => ['Maneuver', 'text'],
            'value' => ['Count', 'count'],
        ], collect($this->maneuverMetrics($period, $filters)));
    }

    private function lifecycle(BookingStatus $status): Builder
    {
        return DB::table('booking_events')->where('event_type', 'status_changed')->where('new_status', $status->value)
            ->groupBy('booking_id')->selectRaw('booking_id, max(created_at) as occurred_at');
    }

    private function bookingQuery(array $filters, bool $historical = false, bool $includeOperator = false): Builder
    {
        return DB::table('bookings')
            ->when(! $historical, fn (Builder $query) => $query->whereNull('bookings.deleted_at'))
            ->when(isset($filters['vehicle_id']), fn (Builder $query) => $query->where('bookings.vehicle_id', $filters['vehicle_id']))
            ->when(isset($filters['rental_type']), fn (Builder $query) => $query->where('bookings.rental_type', $filters['rental_type']))
            ->when($this->searchPattern($filters), fn (Builder $query, string $pattern) => $query
                ->where(fn (Builder $match) => $match
                    ->whereRaw("bookings.booking_code LIKE ? ESCAPE '!'", [$pattern])
                    ->orWhereExists($this->matchingVehicle('bookings.vehicle_id', $pattern))
                    ->orWhereExists(DB::table('users as search_customer')->selectRaw('1')
                        ->whereColumn('search_customer.id', 'bookings.user_id')
                        ->whereRaw("search_customer.name LIKE ? ESCAPE '!'", [$pattern]))
                    ->when($includeOperator, fn (Builder $match) => $match->orWhereExists(DB::table('telematics_trips as search_trip')
                        ->join('users as search_operator', 'search_operator.id', '=', 'search_trip.operator_user_id')
                        ->selectRaw('1')->whereColumn('search_trip.booking_id', 'bookings.id')
                        ->whereRaw("search_operator.name LIKE ? ESCAPE '!'", [$pattern])))));
    }

    private function matchingVehicle(string $vehicleId, string $pattern): Builder
    {
        return DB::table('vehicles as search_vehicle')->selectRaw('1')
            ->whereColumn('search_vehicle.id', $vehicleId)
            ->where(fn (Builder $match) => $match
                ->whereRaw("search_vehicle.name LIKE ? ESCAPE '!'", [$pattern])
                ->orWhereRaw("search_vehicle.brand LIKE ? ESCAPE '!'", [$pattern])
                ->orWhereRaw("search_vehicle.model LIKE ? ESCAPE '!'", [$pattern])
                ->orWhereRaw("search_vehicle.plate_number LIKE ? ESCAPE '!'", [$pattern]));
    }

    private function searchPattern(array $filters): ?string
    {
        $search = trim($filters['search'] ?? '');

        return $search === '' ? null : '%'.strtr($search, ['!' => '!!', '%' => '!%', '_' => '!_']).'%';
    }

    private function vehicleLabel(string $name, ?string $plate): string
    {
        return $plate ? "{$name} ({$plate})" : $name;
    }

    private function metric(string $label, int|float|null $value, string $format = 'count'): array
    {
        return compact('label', 'value', 'format');
    }

    private function chart(string $title, string $type, string $format, array $series, array $points): array
    {
        return [
            'title' => $title,
            'type' => $type,
            'format' => $format,
            'series' => collect($series)->map(fn (string $label, string $key) => compact('key', 'label'))->values()->all(),
            'points' => array_values($points),
        ];
    }

    private function table(string $title, array $columns, Builder|Collection $rows): array
    {
        return [
            'title' => $title,
            'columns' => collect($columns)->map(fn (array $column, string $key) => [
                'key' => $key, 'label' => $column[0], 'format' => $column[1],
            ])->values()->all(),
            'rows' => $rows,
        ];
    }

    private function page(array $table, int $page, int $perPage): array
    {
        if ($table['rows'] instanceof Builder) {
            $pagination = $table['rows']->paginate($perPage, ['*'], 'page', $page);
            $rows = $pagination->items();
            $total = $pagination->total();
        } else {
            $rows = $table['rows']->forPage($page, $perPage)->all();
            $total = $table['rows']->count();
        }

        return [
            ...$table,
            'rows' => $this->tableRows($table, collect($rows)->lazy())->values()->all(),
            'page' => $page,
            'lastPage' => max(1, (int) ceil($total / $perPage)),
            'total' => $total,
        ];
    }

    private function tableRows(array $table, LazyCollection $rows): LazyCollection
    {
        return $rows->map(function (array|object $row) use ($table) {
            $row = (array) $row;
            $values = [];
            foreach ($table['columns'] as ['key' => $key, 'format' => $format]) {
                $value = $row[$key];
                if ($key === 'purpose' && $row['entry_type'] === 'Receipt') {
                    $values[$key] = $this->paymentPurposeLabel($value);

                    continue;
                }
                $values[$key] = $value === null ? null : match ($format) {
                    'datetime' => CarbonImmutable::parse($value, 'UTC')->toISOString(),
                    'money', 'hours' => (float) $value,
                    'rating' => round((float) $value, 1),
                    'count' => (int) $value,
                    default => match ($key) {
                        'rental_type' => self::RENTAL_TYPES[$value],
                        'method' => $value === 'paypal' ? 'PayPal' : str($value)->headline()->toString(),
                        'outcome' => $value === 'no_show' ? 'No-show' : str($value)->headline()->toString(),
                        default => $value,
                    },
                };
            }

            if (array_key_exists('lifetime_rating', $values)) {
                $values['customer_id'] = (int) $row['customer_id'];
                $values['rating_count'] = (int) $row['rating_count'];
            }

            return $values;
        });
    }
}
