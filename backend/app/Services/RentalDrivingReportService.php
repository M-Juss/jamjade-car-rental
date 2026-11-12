<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\DriveMonitoringSession;
use App\Models\RentalDrivingReport;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Throwable;

class RentalDrivingReportService
{
    public function __construct(
        private readonly RentalDrivingAnalysisService $analysis,
        private readonly DriveMonitoringEventService $events,
        private readonly NotificationService $notifications,
    ) {}

    public function process(): int
    {
        $count = 0;
        Booking::where('status', BookingStatus::Completed)
            ->whereNotIn('id', RentalDrivingReport::select('booking_id'))
            ->whereHas('telematicsTrip', fn ($query) => $query->whereExists(
                DriveMonitoringSession::selectRaw('1')->whereColumn('telematics_trip_id', 'telematics_trips.id')
            ))
            ->select('bookings.id')->chunkById(100, function ($bookings) use (&$count) {
                foreach ($bookings as $booking) {
                    try {
                        $count += (int) $this->finalize($booking->id);
                    } catch (Throwable $error) {
                        report($error);
                    }
                }
            });

        return $count;
    }

    public function acceptsLateReadings(Booking $booking): bool
    {
        return $booking->status !== BookingStatus::Completed
            || ($this->deadline($booking)->isFuture() && ! RentalDrivingReport::where('booking_id', $booking->id)->exists());
    }

    public function finalize(int $bookingId): bool
    {
        return DB::transaction(function () use ($bookingId) {
            // Rental batch and stop requests take this same lock before touching sessions.
            $booking = Booking::lockForUpdate()->find($bookingId);
            if ($booking?->status !== BookingStatus::Completed || RentalDrivingReport::where('booking_id', $bookingId)->exists()) {
                return false;
            }
            $trip = $booking->telematicsTrip;
            if (! $trip) {
                return false;
            }
            $sessions = DriveMonitoringSession::where('telematics_trip_id', $trip->id);
            if (! (clone $sessions)->exists()) {
                return false;
            }
            $active = (clone $sessions)->where('status', 'active');
            $deadline = $this->deadline($booking);
            $awaitingSync = (clone $active)->exists();
            if ($awaitingSync && $deadline->isFuture()) {
                return false;
            }
            $incomplete = $awaitingSync || (clone $sessions)->where(fn ($query) => $query
                ->where('sync_interrupted', true)->orWhere('ended_at', '>=', $deadline))->exists();
            $finalizedAt = now();
            foreach ($active->lockForUpdate()->get() as $session) {
                $this->events->finish($session);
                $session->update([
                    'status' => 'stopped',
                    'ended_at' => $finalizedAt,
                    'sync_interrupted' => true,
                    'capture_closed_ms' => $session->capture_closed_ms
                        ?? ($booking->returnRecord?->vehicle_received_at ?? $trip->ended_at ?? $booking->completed_at ?? $booking->updated_at)->getTimestampMs(),
                ]);
            }
            $snapshot = $this->analysis->receivedSummary($booking, $trip->id);
            $grade = $snapshot['grading'];
            $snapshot['grading'] = [
                ...$grade,
                'status' => $grade['score'] === null ? 'not_graded' : 'final',
                'finalized_at' => $finalizedAt->toISOString(),
                'sync_incomplete' => $incomplete,
            ];
            RentalDrivingReport::create([
                'booking_id' => $booking->id,
                'score' => $grade['score'],
                'confirmed_events' => $grade['confirmed_events'],
                'snapshot' => $snapshot,
                'finalized_at' => $finalizedAt,
            ]);
            $this->notify($booking, $trip->operator_user_id, $snapshot);

            return true;
        }, 3);
    }

    private function deadline(Booking $booking): CarbonInterface
    {
        return ($booking->completed_at ?? $booking->updated_at)->copy()
            ->addHours(config('telematics.driving_report_sync_hours'));
    }

    private function notify(Booking $booking, ?int $operatorId, array $snapshot): void
    {
        $grade = $snapshot['grading'];
        $score = $grade['score'];
        $gradeText = $score === null ? 'Not graded' : "{$score} / {$grade['maximum']}";
        $lines = ["Overall grade: {$gradeText}", "Booking: {$booking->booking_code}", ''];
        if ($score !== null) {
            $lines[] = "Starting score: {$grade['maximum']}";
            foreach ([
                'harsh_acceleration' => 'Harsh acceleration',
                'harsh_braking' => 'Harsh braking',
                'harsh_cornering' => 'Harsh cornering',
                'harsh_swerve' => 'Harsh swerving',
            ] as $key => $label) {
                $item = $grade['breakdown'][$key];
                $lines[] = "{$label}: {$item['count']} × {$item['points_each']} = −{$item['deduction']}";
            }
            $lines[] = "Total deductions: −{$grade['deductions']}";
            $lines[] = $grade['deductions'] <= $grade['maximum']
                ? "Calculation: {$grade['maximum']} − {$grade['deductions']} = {$score}"
                : 'The deductions reached the minimum grade of 0.';
        }

        $summary = $score === null
            ? 'No motion readings were received for this rental.'
            : "Received RC readings included {$grade['confirmed_events']} confirmed harsh events. Uncertain maneuvers do not deduct points.";
        if ($score !== null && $snapshot['coverage']['percent'] !== null) {
            $summary .= " Received readings cover {$snapshot['coverage']['percent']}% of the released rental.";
        }
        if ($grade['sync_incomplete']) {
            $summary .= ' Sync could not be confirmed for every segment. Some readings may be missing.';
        }
        $lines[] = '';
        $lines[] = 'Summary';
        $lines[] = $summary;
        $data = [
            'booking_id' => $booking->id,
            'event_type' => 'driving_report_ready',
            'action_label' => 'View booking',
            'full_message' => implode("\n", $lines),
        ];
        $title = 'Driving report ready';
        $preview = "Overall grade {$gradeText} · {$booking->booking_code}";
        if ($booking->user) {
            $this->notifications->createForBooking($booking, 'booking', $title, $preview, $data);
        }
        $driver = $booking->rental_type === RentalType::OwnersDriver ? $booking->assignedDriver : null;
        if ($driver && $driver->id === $operatorId && $driver->id !== $booking->user_id) {
            $this->notifications->createForUser($driver, 'booking', $title, $preview, $data);
        }
    }
}
