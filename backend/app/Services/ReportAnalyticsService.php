<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\TelematicsEventType;
use App\Support\ReportPeriod;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\LazyCollection;

class ReportAnalyticsService
{
    public const SECTIONS = ['overview', 'revenue', 'bookings', 'fleet', 'customers', 'telematics'];

    public const PAGE_SIZE = 10;

    private const RENTAL_TYPES = ['self_drive' => 'Self Drive', 'owners_driver' => 'With Assigned Driver'];

    public function analytics(string $section, ReportPeriod $period, array $filters): array
    {
        $dataset = $this->dataset($section, $period, $filters);
        $table = $section === 'overview'
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
            'bookings' => $this->bookingTable($this->bookingActivity($period, $filters)),
            'telematics' => $this->telematicsTable($this->telematicsEvents($period, $filters)),
            default => $this->dataset($section, $period, $filters)['table'],
        };

        return [
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
        $activity = $this->bookingTotals($this->bookingActivity($period, $filters), $period);
        $rows = collect($cash['points'])->map(fn (array $point, string $key) => [
            ...$point,
            'bookings' => $activity['points'][$key]['created'],
            'completed' => $activity['points'][$key]['completed'],
        ])->values();

        return [
            'metrics' => [
                ...$this->cashMetrics($cash),
                $this->metric('Bookings created', $activity['totals']['created']),
                $this->metric('Rentals completed', $activity['totals']['completed']),
            ],
            'charts' => [
                $this->chart('Net receipts', 'line', 'money', ['net' => 'Net receipts'], $cash['points']),
                $this->chart('Booking activity', 'bar', 'count', ['created' => 'Bookings created', 'completed' => 'Rentals completed'], $activity['points']),
            ],
            'table' => $this->table('Period totals', [
                'label' => ['Period', 'text'],
                'gross' => ['Gross receipts', 'money'],
                'refunds' => ['Refunds paid', 'money'],
                'net' => ['Net receipts', 'money'],
                'bookings' => ['Bookings created', 'count'],
                'completed' => ['Rentals completed', 'count'],
            ], $rows),
        ];
    }

    private function revenue(ReportPeriod $period, array $filters): array
    {
        $entries = $this->cashEntries($period, $filters);
        $cash = $this->cashTotals($entries, $period);
        $byType = collect($cash['rentalTypes'])->map(fn (int $cents, string $type) => [
            'label' => self::RENTAL_TYPES[$type],
            'net' => $cents / 100,
        ])->all();

        return [
            'metrics' => $this->cashMetrics($cash),
            'charts' => [
                $this->chart('Receipts and refunds', 'bar', 'money', ['gross' => 'Gross receipts', 'refunds' => 'Refunds paid'], $cash['points']),
                $this->chart('Net receipts by rental type', 'bar', 'money', ['net' => 'Net receipts'], $byType),
            ],
            'table' => $this->revenueTable($entries),
        ];
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
                bookings.booking_code as booking, bookings.rental_type, vehicles.name as vehicle");

        $refunds = $this->bookingQuery($filters, historical: true)
            ->join('booking_cancellations as refund', 'refund.booking_id', '=', 'bookings.id')
            ->leftJoin('vehicles', 'vehicles.id', '=', 'bookings.vehicle_id')
            ->where('refund.refund_amount', '>', 0)
            ->selectRaw("refund.id as entry_id, refund.refunded_at as occurred_at,
                'Refund' as entry_type, null as method, -refund.refund_amount as amount,
                bookings.booking_code as booking, bookings.rental_type, vehicles.name as vehicle");

        return DB::query()->fromSub($payments->unionAll($period->constrain($refunds, 'refund.refunded_at')), 'cash_entries');
    }

    private function cashTotals(Builder $entries, ReportPeriod $period): array
    {
        $points = $period->points(['gross' => 0, 'refunds' => 0, 'net' => 0]);
        $gross = 0;
        $refunds = 0;
        $rentalTypes = [];

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
            $rentalTypes[$entry->rental_type] = ($rentalTypes[$entry->rental_type] ?? 0) + $cents;
        }

        return [
            'points' => array_map(fn (array $point) => [
                ...$point, 'gross' => $point['gross'] / 100, 'refunds' => $point['refunds'] / 100, 'net' => $point['net'] / 100,
            ], $points),
            'gross' => $gross / 100,
            'refunds' => $refunds / 100,
            'net' => ($gross - $refunds) / 100,
            'rentalTypes' => $rentalTypes,
        ];
    }

    private function cashMetrics(array $cash): array
    {
        return [
            $this->metric('Gross receipts', $cash['gross'], 'money'),
            $this->metric('Refunds paid', $cash['refunds'], 'money'),
            $this->metric('Net receipts', $cash['net'], 'money'),
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
            'table' => $this->bookingTable($events),
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
            ->whereIn('event.new_status', ['completed', 'cancelled', 'rejected'])
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
        return $this->table('Booking activity', [
            'occurred_at' => ['Date', 'datetime'],
            'booking' => ['Booking', 'text'],
            'vehicle' => ['Vehicle', 'text'],
            'rental_type' => ['Rental type', 'text'],
            'outcome' => ['Activity', 'text'],
        ], $query->orderByDesc('occurred_at')->orderBy('outcome')->orderByDesc('entry_id'));
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
        $firstRental = DB::query()->fromSub(clone $completions, 'first_completion')
            ->join('bookings', 'bookings.id', '=', 'first_completion.booking_id')
            ->whereNull('bookings.deleted_at')
            ->groupBy('bookings.user_id')->selectRaw('bookings.user_id, min(first_completion.occurred_at) as first_completed');
        $rentals = $this->bookingQuery($filters)->joinSub($completions, 'completion', 'completion.booking_id', '=', 'bookings.id')
            ->joinSub($firstRental, 'history', 'history.user_id', '=', 'bookings.user_id')
            ->leftJoin('users', 'users.id', '=', 'bookings.user_id')
            ->select(['bookings.user_id', 'users.name as customer', 'completion.occurred_at', 'history.first_completed']);
        $points = $period->points(['firstTime' => 0, 'returning' => 0]);
        $rows = [];
        $seen = [];

        foreach ($period->constrain($rentals, 'completion.occurred_at')->orderBy('completion.occurred_at')->cursor() as $rental) {
            $bucket = $period->bucket($rental->occurred_at);
            if (! isset($seen[$bucket][$rental->user_id])) {
                $group = $period->bucket($rental->first_completed) === $bucket ? 'firstTime' : 'returning';
                $points[$bucket][$group]++;
                $seen[$bucket][$rental->user_id] = true;
            }
            $rows[$rental->user_id] ??= [
                'customer' => $rental->customer,
                'completed' => 0,
                'first_completed' => $rental->first_completed,
                'last_completed' => null,
            ];
            $rows[$rental->user_id]['completed']++;
            $rows[$rental->user_id]['last_completed'] = $rental->occurred_at;
        }

        $customers = collect(array_values($rows))->sortBy([['completed', 'desc'], ['customer', 'asc']])->values();

        return [
            'metrics' => [$this->metric('Renters', $customers->count()), $this->metric('Rentals completed', (int) $customers->sum('completed'))],
            'charts' => [$this->chart('First-time and returning renters', 'stacked', 'count', ['firstTime' => 'First-time', 'returning' => 'Returning'], $points)],
            'table' => $this->table('Renters', [
                'customer' => ['Customer', 'text'],
                'completed' => ['Rentals completed', 'count'],
                'first_completed' => ['First completed rental', 'datetime'],
                'last_completed' => ['Latest in period', 'datetime'],
            ], $customers),
        ];
    }

    private function telematics(ReportPeriod $period, array $filters): array
    {
        $events = $this->telematicsEvents($period, $filters);
        $counts = (clone $events)->groupBy('event.event_type')->selectRaw('event.event_type, count(*) as total')->pluck('total', 'event_type');
        $released = $period->constrain($this->bookingQuery($filters)
            ->joinSub($this->lifecycle(BookingStatus::Ongoing), 'release', 'release.booking_id', '=', 'bookings.id'), 'release.occurred_at');
        $monitored = (clone $released)->whereExists(fn (Builder $query) => $query->selectRaw('1')
            ->from('telematics_trips')->whereColumn('telematics_trips.booking_id', 'bookings.id')
            ->whereColumn('telematics_trips.started_at', '>=', 'release.occurred_at')
            ->where('telematics_trips.started_at', '<', $period->dataEnd->utc()))->count();
        $exits = (int) $counts->get(TelematicsEventType::GeofenceExit->value, 0);
        $points = $counts->map(fn ($count, string $event) => [
            'label' => TelematicsEventType::from($event)->label(), 'count' => (int) $count,
        ])->values()->all();

        return [
            'metrics' => [
                $this->metric('Rentals released', $released->count()),
                $this->metric('Monitoring started', $monitored),
                $this->metric('Geofence exits', $exits),
                $this->metric('Monitoring interruptions', (int) $counts->sum() - $exits),
            ],
            'charts' => [$this->chart('Recorded events', 'horizontal', 'count', ['count' => 'Events'], $points)],
            'table' => $this->telematicsTable($events),
        ];
    }

    private function telematicsEvents(ReportPeriod $period, array $filters): Builder
    {
        return $period->constrain($this->bookingQuery($filters)
            ->join('telematics_trips as trip', 'trip.booking_id', '=', 'bookings.id')
            ->join('telematics_events as event', 'event.trip_id', '=', 'trip.id')
            ->leftJoin('vehicles', 'vehicles.id', '=', 'bookings.vehicle_id')
            ->whereIn('event.event_type', [
                TelematicsEventType::GeofenceExit->value,
                TelematicsEventType::GpsUnavailable->value,
                TelematicsEventType::LocationPermissionRevoked->value,
                TelematicsEventType::TelemetryInterrupted->value,
            ]), 'event.occurred_at');
    }

    private function telematicsTable(Builder $query): array
    {
        return $this->table('Event log', [
            'occurred_at' => ['Date', 'datetime'],
            'booking' => ['Booking', 'text'],
            'vehicle' => ['Vehicle', 'text'],
            'event_type' => ['Event', 'text'],
        ], $query->select(['event.occurred_at', 'bookings.booking_code as booking', 'vehicles.name as vehicle', 'event.event_type'])
            ->orderByDesc('event.occurred_at')->orderByDesc('event.id'));
    }

    private function lifecycle(BookingStatus $status): Builder
    {
        return DB::table('booking_events')->where('event_type', 'status_changed')->where('new_status', $status->value)
            ->groupBy('booking_id')->selectRaw('booking_id, max(created_at) as occurred_at');
    }

    private function bookingQuery(array $filters, bool $historical = false): Builder
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
                        ->whereRaw("search_customer.name LIKE ? ESCAPE '!'", [$pattern]))));
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
                $values[$key] = $value === null ? null : match ($format) {
                    'datetime' => CarbonImmutable::parse($value, 'UTC')->toISOString(),
                    'money', 'hours' => (float) $value,
                    'count' => (int) $value,
                    default => match ($key) {
                        'rental_type' => self::RENTAL_TYPES[$value],
                        'method' => $value === 'paypal' ? 'PayPal' : str($value)->headline()->toString(),
                        'outcome' => $value === 'no_show' ? 'No-show' : str($value)->headline()->toString(),
                        'event_type' => TelematicsEventType::from($value)->label(),
                        default => $value,
                    },
                };
            }

            return $values;
        });
    }
}
