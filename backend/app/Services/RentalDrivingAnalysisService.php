<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Models\Booking;
use App\Models\DriveMonitoringBatch;
use App\Models\DriveMonitoringEvent;
use App\Models\DriveMonitoringSession;
use App\Models\RentalDrivingReport;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class RentalDrivingAnalysisService
{
    public function forBooking(Booking $record): array
    {
        $trip = $record->telematicsTrips()->with('operator:id,name')->first();
        $tripId = $trip?->id;
        $report = $record->status === BookingStatus::Completed
            ? RentalDrivingReport::where('booking_id', $record->id)->first() : null;
        $summary = $report?->snapshot ?? $this->receivedSummary($record, $tripId);
        if ($record->status === BookingStatus::Completed && ! $report) {
            $summary['grading'] = $this->unfinalizedGrade($summary['session_status'] !== null);
        }
        $sessions = DriveMonitoringSession::where('telematics_trip_id', $tripId ?? 0);
        $visibleEvents = DriveMonitoringEvent::whereIn('session_id', $sessions->select('id'))
            ->join('drive_monitoring_sessions as capture', 'capture.id', '=', 'drive_monitoring_events.session_id')
            ->whereIn('drive_monitoring_events.status', ['confirmed', 'review_required'])
            ->select('drive_monitoring_events.*')
            ->selectRaw('capture.capture_started_ms + drive_monitoring_events.start_ms as occurred_ms')
            ->orderByDesc('occurred_ms')->latest('drive_monitoring_events.created_at')
            ->orderByDesc('drive_monitoring_events.id')->limit(50)->get();

        return [...$summary,
            'sensor_platform' => 'rc',
            'operator' => $trip?->operator ? ['id' => $trip->operator->id, 'name' => $trip->operator->name] : null,
            'events' => $visibleEvents,
        ];
    }

    public function receivedSummary(Booking $record, ?int $tripId): array
    {
        $sessions = DriveMonitoringSession::where('telematics_trip_id', $tripId ?? 0);
        $events = DriveMonitoringEvent::whereIn('session_id', (clone $sessions)->select('id'));
        $counts = (clone $events)->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');
        $maneuvers = (clone $events)->where('status', 'confirmed')
            ->selectRaw('target, count(*) as total')->groupBy('target')->pluck('total', 'target');
        $latest = (clone $sessions)->latest()->first();
        $received = DriveMonitoringBatch::whereIn('session_id', (clone $sessions)->select('id'))->latest()->first();
        $confirmed = collect(array_keys(RentalDrivingScoreService::WEIGHTS))
            ->mapWithKeys(fn ($target) => [$target => (int) ($maneuvers[$target] ?? 0)])->all();

        return [
            'session_status' => $latest?->status,
            'coverage' => app(RentalMotionCoverageService::class)->forBooking($record, $tripId),
            'sync_pending' => (clone $sessions)->where('status', 'active')->exists(),
            'maneuvers' => $confirmed,
            'grading' => app(RentalDrivingScoreService::class)->forReceivedReadings($confirmed, $received !== null),
            'latest_received_at' => $received?->created_at?->toISOString(),
            'event_summary' => ['detected' => (int) ($counts['confirmed'] ?? 0), 'needs_review' => (int) ($counts['review_required'] ?? 0), 'pending' => (int) ($counts['pending'] ?? 0)],
        ];
    }

    /** Bounded page summaries without loading event logs or encrypted receipts. */
    public function gradesForBookings(Collection $bookings): array
    {
        $ids = $bookings->pluck('id');
        $reports = RentalDrivingReport::whereIn('booking_id', $ids)->get()->keyBy('booking_id');
        $attempts = DB::table('drive_monitoring_sessions as capture')
            ->join('telematics_trips as trip', 'trip.id', '=', 'capture.telematics_trip_id')
            ->whereIn('trip.booking_id', $ids)->distinct()->pluck('trip.booking_id')->flip();

        return $bookings->mapWithKeys(fn ($booking) => [(string) $booking->id => $reports->get($booking->id)?->snapshot['grading']
            ?? $this->unfinalizedGrade($attempts->has($booking->id))])->all();
    }

    private function unfinalizedGrade(bool $hasMotionSession): array
    {
        $grade = app(RentalDrivingScoreService::class)->forReceivedReadings([], false);

        return $hasMotionSession ? [...$grade, 'status' => 'pending'] : $grade;
    }
}
