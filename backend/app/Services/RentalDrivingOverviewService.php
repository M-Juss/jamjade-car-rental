<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Support\ReportPeriod;
use Illuminate\Database\Query\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class RentalDrivingOverviewService
{
    public const ATTENTION_GRADE_THRESHOLD = 70;

    /** One row per completed booking. No raw telemetry or receipt payloads. */
    public function rentals(array $filters = [], bool $operatorSearch = false): Builder
    {
        $completion = DB::table('booking_events')->where('event_type', 'status_changed')
            ->where('new_status', BookingStatus::Completed->value)
            ->select('booking_id')->selectRaw('max(created_at) as completed_at')->groupBy('booking_id');
        $query = DB::table('bookings as booking')
            ->leftJoin('telematics_trips as trip', 'trip.booking_id', '=', 'booking.id')
            ->leftJoin('users as operator', 'operator.id', '=', 'trip.operator_user_id')
            ->leftJoin('users as customer', 'customer.id', '=', 'booking.user_id')
            ->leftJoin('vehicles as vehicle', 'vehicle.id', '=', 'booking.vehicle_id')
            ->leftJoinSub($completion, 'completion', 'completion.booking_id', '=', 'booking.id')
            ->leftJoin('rental_driving_reports as report', 'report.booking_id', '=', 'booking.id')
            ->whereNull('booking.deleted_at')->where('booking.status', BookingStatus::Completed->value)
            ->when(isset($filters['period'], $filters['date']), fn ($q) => (new ReportPeriod($filters['period'], $filters['date']))->constrain($q, 'completion.completed_at'))
            ->when($filters['graded_only'] ?? false, fn ($q) => $q->whereNotNull('report.score'))
            ->when($filters['operator_id'] ?? null, fn ($q, $id) => $q->where('trip.operator_user_id', $id))
            ->when($filters['operator_type'] ?? null, fn ($q, $type) => $q->where('booking.rental_type',
                $type === 'customer' ? RentalType::SelfDrive->value : RentalType::OwnersDriver->value))
            ->when($filters['vehicle_id'] ?? null, fn ($q, $id) => $q->where('booking.vehicle_id', $id))
            ->when($filters['search'] ?? null, function ($q, $search) use ($operatorSearch) {
                $pattern = '%'.strtr(trim($search), ['!' => '!!', '%' => '!%', '_' => '!_']).'%';
                $q->where(function ($q) use ($pattern, $operatorSearch) {
                    $q->whereRaw("operator.name LIKE ? ESCAPE '!'", [$pattern]);
                    if (! $operatorSearch) {
                        $q->orWhereRaw("booking.booking_code LIKE ? ESCAPE '!'", [$pattern])
                            ->orWhereRaw("vehicle.name LIKE ? ESCAPE '!'", [$pattern])
                            ->orWhereRaw("vehicle.brand LIKE ? ESCAPE '!'", [$pattern])
                            ->orWhereRaw("vehicle.model LIKE ? ESCAPE '!'", [$pattern])
                            ->orWhereRaw("vehicle.plate_number LIKE ? ESCAPE '!'", [$pattern])
                            ->orWhereRaw("customer.name LIKE ? ESCAPE '!'", [$pattern]);
                    }
                });
            });

        return $query->select('booking.id as booking_id', 'completion.completed_at', 'trip.operator_user_id as operator_id', 'operator.name as operator_name')
            ->selectRaw('CASE WHEN booking.rental_type = ? THEN ? ELSE ? END as operator_type', [RentalType::SelfDrive->value, 'customer', 'driver'])
            ->selectRaw('CASE WHEN report.score IS NULL THEN 0 ELSE 1 END as monitored')
            ->selectRaw('COALESCE(report.confirmed_events, 0) as harsh_events')
            ->addSelect('report.score', 'report.snapshot->grading->sync_incomplete as sync_incomplete');
    }

    public function summary(Builder $rentals): array
    {
        $row = DB::query()->fromSub($rentals, 'rental')->selectRaw('count(*) as completed_rentals,
            count(distinct CASE WHEN monitored = 1 THEN operator_id END) as operators_monitored,
            avg(score) as average_score, COALESCE(sum(harsh_events), 0) as harsh_events,
            COALESCE(sum(CASE WHEN score IS NOT NULL AND sync_incomplete IN (1, \'true\') THEN 1 ELSE 0 END), 0) as incomplete_grades')->first();

        return ['completed_rentals' => (int) $row->completed_rentals,
            'operators_monitored' => (int) $row->operators_monitored,
            'average_score' => $row->average_score === null ? null : round((float) $row->average_score, 1),
            'harsh_events' => (int) $row->harsh_events, 'incomplete_grades' => (int) $row->incomplete_grades];
    }

    public function operators(Builder $rentals, int $perPage, ?int $belowGrade = null, string $pageName = 'page', ?int $page = null): LengthAwarePaginator
    {
        $rows = DB::query()->fromSub($rentals, 'rental')->whereNotNull('operator_id')
            ->select('operator_id', 'operator_name', 'operator_type')
            ->selectRaw('count(*) as completed_rentals, sum(monitored) as monitored_rentals,
                avg(score) as average_score, sum(harsh_events) as harsh_events,
                sum(CASE WHEN score IS NOT NULL AND sync_incomplete IN (1, \'true\') THEN 1 ELSE 0 END) as incomplete_grades')
            ->groupBy('operator_id', 'operator_name', 'operator_type')
            ->when($belowGrade !== null, fn ($query) => $query->havingRaw('round(avg(score), 1) < ?', [$belowGrade])->orderByRaw('avg(score) asc'))
            ->orderBy('operator_name')->orderBy('operator_id')->orderBy('operator_type')->paginate($perPage, ['*'], $pageName, $page);
        $ids = $rows->getCollection()->pluck('operator_id');
        // The latest received drive per operator, ordered by completion time then booking ID.
        $latest = DB::query()->fromSub(clone $rentals, 'candidate')->whereIn('candidate.operator_id', $ids)
            ->whereNotNull('candidate.score')->whereNotExists(function ($query) use ($rentals) {
                $query->selectRaw('1')->fromSub(clone $rentals, 'newer')->whereNotNull('newer.score')
                    ->whereColumn('newer.operator_id', 'candidate.operator_id')
                    ->whereColumn('newer.operator_type', 'candidate.operator_type')->where(function ($q) {
                        $q->whereColumn('newer.completed_at', '>', 'candidate.completed_at')
                            ->orWhere(fn ($q) => $q->whereNull('candidate.completed_at')->whereNotNull('newer.completed_at'))
                            ->orWhere(function ($q) {
                                $q->where(fn ($q) => $q->whereColumn('newer.completed_at', '=', 'candidate.completed_at')
                                    ->orWhere(fn ($q) => $q->whereNull('newer.completed_at')->whereNull('candidate.completed_at')))
                                    ->whereColumn('newer.booking_id', '>', 'candidate.booking_id');
                            });
                    });
            })->get()->keyBy(fn ($row) => $row->operator_id.':'.$row->operator_type);
        $rows->getCollection()->each(function ($row) use ($latest) {
            $latestRental = $latest->get($row->operator_id.':'.$row->operator_type);
            $row->latest_score = $latestRental?->score;
            $row->latest_sync_incomplete = in_array($latestRental?->sync_incomplete, [true, 1, '1', 'true'], true);
        });

        return $rows;
    }

    public function recordedOperators(Collection $bookings): array
    {
        return DB::table('telematics_trips as trip')->leftJoin('users as operator', 'operator.id', '=', 'trip.operator_user_id')
            ->whereIn('trip.booking_id', $bookings->pluck('id'))->select('trip.booking_id', 'operator.id', 'operator.name')
            ->get()->mapWithKeys(fn ($row) => [(string) $row->booking_id => ['id' => $row->id, 'name' => $row->name]])->all();
    }

    public function operatorFilter(int $id): ?array
    {
        $row = DB::table('telematics_trips as trip')->join('bookings as booking', 'booking.id', '=', 'trip.booking_id')
            ->join('users as operator', 'operator.id', '=', 'trip.operator_user_id')
            ->whereNull('booking.deleted_at')->where('booking.status', BookingStatus::Completed->value)
            ->where('operator.id', $id)->select('operator.id', 'operator.name')->first();

        return $row ? ['id' => $row->id, 'name' => $row->name] : null;
    }

    public function vehicleOptions(): array
    {
        return DB::table('vehicles as vehicle')->whereExists(function ($query) {
            $query->selectRaw('1')->from('bookings as booking')->whereColumn('booking.vehicle_id', 'vehicle.id')
                ->whereNull('booking.deleted_at')->where('booking.status', BookingStatus::Completed->value);
        })->orderBy('vehicle.brand')->orderBy('vehicle.name')->orderBy('vehicle.plate_number')->orderBy('vehicle.id')
            ->get(['vehicle.id', 'vehicle.brand', 'vehicle.name', 'vehicle.plate_number'])
            ->map(fn ($vehicle) => ['value' => (string) $vehicle->id,
                'label' => implode(' ', array_filter([$vehicle->brand, $vehicle->name, $vehicle->plate_number]))])->all();
    }
}
