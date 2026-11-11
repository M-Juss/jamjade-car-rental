<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Facades\DB;

class RentalActivityService
{
    public function __construct(private readonly LocationMonitoringService $locations) {}

    public function page(User $operator, string $code, ?string $cursor): CursorPaginator
    {
        $booking = $this->locations->bookingFor($operator, $code);
        // The existing zone notices preserve the original UTC capture time in their payload.
        $sqlite = DB::connection()->getDriverName() === 'sqlite';
        $type = "json_extract(data, '$.event_type')";
        $time = "json_extract(data, '$.occurred_at')";
        if (! $sqlite) {
            $type = "json_unquote($type)";
            $time = "json_unquote($time)";
        }
        $zoneTime = "case when $type in ('geofence_enter', 'geofence_exit', 'geofence_initial_inside') then $time end";
        $occurredMs = $sqlite
            ? "cast(round((julianday($zoneTime) - 2440587.5) * 86400000) as integer)"
            : "timestampdiff(microsecond, '1970-01-01 00:00:00', replace(replace(($zoneTime), 'T', ' '), 'Z', '')) div 1000";
        $createdMs = $sqlite
            ? "cast(strftime('%s', created_at) as integer) * 1000"
            : "timestampdiff(second, '1970-01-01 00:00:00', created_at) * 1000";

        $notices = DB::table('notifications')->where('user_id', $operator->id)
            ->where('booking_id', $booking->id)->where('category', 'trip')
            ->selectRaw("'notification' as kind, cast(id as char) as source_id, title, message, read_at, null as target, null as status")
            ->selectRaw("coalesce($occurredMs, $createdMs) as occurred_ms");

        $maneuvers = DB::table('drive_monitoring_events as event')
            ->join('drive_monitoring_sessions as capture', 'capture.id', '=', 'event.session_id')
            ->where('capture.telematics_trip_id', $booking->telematicsTrip?->id ?? 0)
            ->where('capture.user_id', $operator->id)
            ->whereNotNull('capture.capture_started_ms')
            ->whereIn('event.status', ['confirmed', 'review_required'])
            ->whereIn('event.target', array_keys(RentalDrivingScoreService::WEIGHTS))
            ->selectRaw("'maneuver' as kind, cast(event.id as char) as source_id, null as title, null as message, null as read_at, event.target, event.status")
            ->selectRaw('capture.capture_started_ms + event.start_ms as occurred_ms');

        $position = Cursor::fromEncoded($cursor);
        if ($position !== null) {
            $position = new Cursor([
                'occurred_ms' => (int) $position->parameter('occurred_ms'),
                'kind' => $position->parameter('kind'),
                'source_id' => $position->parameter('source_id'),
            ]);
        }

        return DB::query()->fromSub($notices->unionAll($maneuvers), 'activity')
            ->orderByDesc('occurred_ms')->orderByDesc('kind')->orderByDesc('source_id')
            ->cursorPaginate(10, ['*'], 'cursor', $position);
    }
}
