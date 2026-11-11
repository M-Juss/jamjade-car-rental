<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\DriveMonitoringSession;
use Illuminate\Support\Facades\DB;

class RentalMotionCoverageService
{
    // The ingestion caller locks the session and owns the transaction.
    public function receive(DriveMonitoringSession $session, array $windows): void
    {
        if ($session->coverage_version !== 1) {
            return;
        }
        foreach ($windows as $window) {
            $start = $window['start_ms'];
            $end = $window['end_ms'];
            $overlaps = DB::table('rental_motion_intervals')->where('session_id', $session->id)
                ->where('start_ms', '<=', $end)->where('end_ms', '>=', $start)->get();
            foreach ($overlaps as $interval) {
                $start = min($start, $interval->start_ms);
                $end = max($end, $interval->end_ms);
            }
            DB::table('rental_motion_intervals')->whereIn('id', $overlaps->pluck('id'))->delete();
            DB::table('rental_motion_intervals')->insert(['session_id' => $session->id, 'start_ms' => $start, 'end_ms' => $end]);
        }
    }

    public function forBooking(Booking $booking, ?int $tripId): array
    {
        $sessions = DriveMonitoringSession::where('telematics_trip_id', $tripId ?? 0);
        $legacy = (clone $sessions)->whereNull('coverage_version')->exists();
        $start = $booking->telematicsSetupSession?->released_at;
        $end = $booking->returnRecord?->vehicle_received_at ?? $booking->telematicsTrip?->ended_at;
        $from = $start?->getTimestampMs();
        $through = ($end ?? now())->getTimestampMs();
        $total = $from === null ? null : max(0, $through - $from);
        $covered = 0;
        $lastEnd = $from ?? 0;
        $gaps = 0;
        $intervals = DB::table('rental_motion_intervals as reading')
            ->join('drive_monitoring_sessions as capture', 'capture.id', '=', 'reading.session_id')
            ->where('capture.telematics_trip_id', $tripId ?? 0)
            ->selectRaw('capture.capture_started_ms + reading.start_ms as begins, capture.capture_started_ms + reading.end_ms as ends')
            ->orderBy('begins')->cursor();
        foreach ($intervals as $interval) {
            if ($interval->begins === null || $from === null) {
                continue;
            }
            $begin = max($from, (int) $interval->begins);
            $finish = min($through, (int) $interval->ends);
            if ($finish <= $begin) {
                continue;
            }
            if ($begin > $lastEnd) {
                $gaps++;
            }
            $covered += max(0, $finish - max($begin, $lastEnd));
            $lastEnd = max($lastEnd, $finish);
        }
        if ($total !== null && $through > $lastEnd) {
            $gaps++;
        }
        $known = ! $legacy && $total !== null && $total > 0;

        return [
            'status' => $legacy ? 'unavailable' : ($covered > 0 ? 'measured' : 'no_readings'),
            'period_ms' => $total,
            'analyzed_ms' => $known ? $covered : null,
            'uncovered_ms' => $known ? max(0, $total - $covered) : null,
            'percent' => $known ? round(100 * $covered / $total, 1) : null,
            'gap_count' => $known ? $gaps : null,
            'period_ended' => $end !== null,
        ];
    }
}
