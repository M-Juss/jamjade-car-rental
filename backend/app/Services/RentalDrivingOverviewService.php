<?php

namespace App\Services;

use App\Enums\BookingStatus;
use Illuminate\Database\Query\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class RentalDrivingOverviewService
{
    /** One row per completed booking. No raw telemetry or receipt payloads. */
    public function rentals(array $filters = [], bool $operatorSearch = false): Builder
    {
        $case = 'CASE event.target ';
        $bindings = [];
        foreach (RentalDrivingScoreService::WEIGHTS as $target => $weight) {
            $case .= 'WHEN ? THEN ? ';
            array_push($bindings, $target, $weight);
        }
        $penalties = DB::table('drive_monitoring_events as event')
            ->join('drive_monitoring_sessions as capture', 'capture.id', '=', 'event.session_id')
            ->where('event.status', 'confirmed')->whereIn('event.target', array_keys(RentalDrivingScoreService::WEIGHTS))
            ->select('capture.telematics_trip_id')->selectRaw("sum($case ELSE 0 END) as deductions", $bindings)
            ->selectRaw('count(*) as event_count')->groupBy('capture.telematics_trip_id');
        $receipts = DB::table('drive_monitoring_batches as batch')
            ->join('drive_monitoring_sessions as capture', 'capture.id', '=', 'batch.session_id')
            ->select('capture.telematics_trip_id')->distinct();
        $completion = DB::table('booking_events')->where('event_type', 'status_changed')
            ->where('new_status', BookingStatus::Completed->value)
            ->select('booking_id')->selectRaw('max(created_at) as completed_at')->groupBy('booking_id');
        $query = DB::table('bookings as booking')
            ->leftJoin('telematics_trips as trip', 'trip.booking_id', '=', 'booking.id')
            ->leftJoin('users as operator', 'operator.id', '=', 'trip.operator_user_id')
            ->leftJoin('users as customer', 'customer.id', '=', 'booking.user_id')
            ->leftJoin('vehicles as vehicle', 'vehicle.id', '=', 'booking.vehicle_id')
            ->leftJoinSub($completion, 'completion', 'completion.booking_id', '=', 'booking.id')
            ->leftJoinSub($penalties, 'penalty', 'penalty.telematics_trip_id', '=', 'trip.id')
            ->leftJoinSub($receipts, 'receipt', 'receipt.telematics_trip_id', '=', 'trip.id')
            ->whereNull('booking.deleted_at')->where('booking.status', BookingStatus::Completed->value)
            ->when($filters['operator_id'] ?? null, fn ($q, $id) => $q->where('trip.operator_user_id', $id))
            ->when($filters['vehicle_id'] ?? null, fn ($q, $id) => $q->where('booking.vehicle_id', $id))
            ->when($filters['search'] ?? null, function ($q, $search) use ($operatorSearch) {
                $q->where(function ($q) use ($search, $operatorSearch) {
                    $q->where('operator.name', 'like', "%{$search}%");
                    if (! $operatorSearch) {
                        $q->orWhere('booking.booking_code', 'like', "%{$search}%")
                            ->orWhere('vehicle.name', 'like', "%{$search}%")
                            ->orWhere('vehicle.plate_number', 'like', "%{$search}%")
                            ->orWhere('customer.name', 'like', "%{$search}%");
                    }
                });
            });

        return $query->select('booking.id as booking_id', 'completion.completed_at', 'trip.operator_user_id as operator_id', 'operator.name as operator_name')
            ->selectRaw('CASE WHEN receipt.telematics_trip_id IS NULL THEN 0 ELSE 1 END as monitored')
            ->selectRaw('COALESCE(penalty.event_count, 0) as harsh_events')
            ->selectRaw('CASE WHEN receipt.telematics_trip_id IS NULL THEN NULL WHEN COALESCE(penalty.deductions, 0) > 100 THEN 0 ELSE 100 - COALESCE(penalty.deductions, 0) END as score');
    }

    public function summary(Builder $rentals): array
    {
        $row = DB::query()->fromSub($rentals, 'rental')->selectRaw('count(*) as completed_rentals,
            count(distinct CASE WHEN monitored = 1 THEN operator_id END) as operators_monitored,
            avg(score) as average_score, COALESCE(sum(harsh_events), 0) as harsh_events')->first();

        return ['completed_rentals' => (int) $row->completed_rentals,
            'operators_monitored' => (int) $row->operators_monitored,
            'average_score' => $row->average_score === null ? null : round((float) $row->average_score, 1),
            'harsh_events' => (int) $row->harsh_events];
    }

    public function operators(Builder $rentals, int $perPage): LengthAwarePaginator
    {
        $rows = DB::query()->fromSub($rentals, 'rental')->whereNotNull('operator_id')
            ->select('operator_id', 'operator_name')
            ->selectRaw('count(*) as completed_rentals, sum(monitored) as monitored_rentals,
                avg(score) as average_score, sum(harsh_events) as harsh_events')
            ->groupBy('operator_id', 'operator_name')->orderBy('operator_name')->orderBy('operator_id')->paginate($perPage);
        $ids = $rows->getCollection()->pluck('operator_id');
        // The latest received drive per operator, ordered by completion time then booking ID.
        $latest = DB::query()->fromSub(clone $rentals, 'candidate')->whereIn('candidate.operator_id', $ids)
            ->whereNotNull('candidate.score')->whereNotExists(function ($query) use ($rentals) {
                $query->selectRaw('1')->fromSub(clone $rentals, 'newer')->whereNotNull('newer.score')
                    ->whereColumn('newer.operator_id', 'candidate.operator_id')->where(function ($q) {
                        $q->whereColumn('newer.completed_at', '>', 'candidate.completed_at')
                            ->orWhere(fn ($q) => $q->whereNull('candidate.completed_at')->whereNotNull('newer.completed_at'))
                            ->orWhere(function ($q) {
                                $q->where(fn ($q) => $q->whereColumn('newer.completed_at', '=', 'candidate.completed_at')
                                    ->orWhere(fn ($q) => $q->whereNull('newer.completed_at')->whereNull('candidate.completed_at')))
                                    ->whereColumn('newer.booking_id', '>', 'candidate.booking_id');
                            });
                    });
            })->get()->keyBy('operator_id');
        $rows->getCollection()->each(function ($row) use ($latest) {
            $row->latest_score = $latest->get($row->operator_id)?->score;
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
