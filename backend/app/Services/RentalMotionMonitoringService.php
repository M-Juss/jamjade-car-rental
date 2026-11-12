<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\DriveMonitoringSession;
use App\Models\TelematicsTrip;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class RentalMotionMonitoringService
{
    public function __construct(private readonly LocationMonitoringService $locations) {}

    public function enabled(): bool
    {
        return app(TelematicsCalibrationProfileService::class)->active()['id'] === 'rc_demo';
    }

    public function start(User $user, string $code, array $input): DriveMonitoringSession
    {
        return DB::transaction(function () use ($user, $code, $input) {
            User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            $booking = $this->booking($user, $code);
            abort_unless($this->enabled() && $this->locations->canMonitor($booking), 422, 'Motion monitoring is unavailable for this rental.');
            $trip = $booking->telematicsTrip;
            abort_unless($trip && $trip->status === 'started' && $trip->operator_user_id === $user->id, 422, 'Start rental monitoring first.');
            TelematicsTrip::whereKey($trip->id)->lockForUpdate()->firstOrFail();
            $previous = DriveMonitoringSession::where('user_id', $user->id)->where('client_session_id', $input['client_session_id'])->first();
            if ($previous) {
                abort_unless((int) $previous->telematics_trip_id === $trip->id, 409, 'Monitoring details changed.');

                return $previous;
            }
            abort_if(DriveMonitoringSession::where('user_id', $user->id)->where('status', 'active')->exists(), 409, 'Finish the previous motion transfer before starting again.');
            $reference = app(RentalMotionReferenceService::class)->reference($booking->telematicsSetupSession);

            return DriveMonitoringSession::create(['telematics_trip_id' => $trip->id, 'user_id' => $user->id,
                'client_session_id' => $input['client_session_id'], 'reference_run_id' => null,
                'coverage_version' => 1,
                'sensor_platform' => 'rc', 'consent_version' => 'rental-rc-motion-v1', 'status' => 'active', 'runtime_reference' => $reference,
                'capture_started_ms' => now()->getTimestampMs(), 'model_sha256' => RcDemoInferenceService::MODEL_SHA256, 'consented_at' => now()]);
        });
    }

    public function batch(User $user, string $code, string $id, array $input): array
    {
        return DB::transaction(function () use ($user, $code, $id, $input) {
            $booking = $this->booking($user, $code);
            $session = $this->session($booking, $user, $id);
            abort_unless($this->enabled(), 403);
            // A stopped GPS/rental can drain earlier windows, never collect new ones.
            $cutoff = $session->capture_closed_ms;
            if (! $this->locations->canMonitor($booking)) {
                $cutoff ??= ($booking->returnRecord?->vehicle_received_at ?? $booking->telematicsTrip->ended_at ?? now())->getTimestampMs();
                $session->update(['capture_closed_ms' => $cutoff]);
            }
            $limit = min(28800000, max(0, ($cutoff ?? now()->getTimestampMs()) - $session->capture_started_ms));
            abort_unless(max(array_column($input['windows'], 'end_ms')) <= $limit, 409, 'These readings extend beyond the monitoring period.');
            $result = app(DriveMonitoringBatchService::class)->receive(
                $session, $input, app(RentalDrivingReportService::class)->acceptsLateReadings($booking)
            );
            app(FleetMonitoringPublisher::class)->changed();

            return $result;
        });
    }

    public function stop(User $user, string $code, string $id, bool $interrupted = false): DriveMonitoringSession
    {
        return DB::transaction(function () use ($user, $code, $id, $interrupted) {
            $session = $this->session($this->booking($user, $code), $user, $id);
            if ($session->status !== 'stopped') {
                app(DriveMonitoringEventService::class)->finish($session);
                $session->update(['status' => 'stopped', 'ended_at' => now(),
                    'sync_interrupted' => $interrupted, 'capture_closed_ms' => $session->capture_closed_ms ?? now()->getTimestampMs()]);
                app(FleetMonitoringPublisher::class)->changed();
            }

            return $session;
        });
    }

    public function state(User $user, string $code): array
    {
        $booking = $this->locations->bookingFor($user, $code);
        $active = $booking->telematicsTrip ? DriveMonitoringSession::where('telematics_trip_id', $booking->telematicsTrip->id)->where('user_id', $user->id)->where('status', 'active')->first() : null;

        return ['available' => $this->enabled() && $this->locations->canMonitor($booking),
            'sensor_platform' => 'rc', 'active_session_id' => $active?->id,
            'report_sync_closed' => ! app(RentalDrivingReportService::class)->acceptsLateReadings($booking)];
    }

    private function booking(User $user, string $code): Booking
    {
        $booking = $this->locations->bookingFor($user, $code);
        Booking::whereKey($booking->id)->lockForUpdate()->firstOrFail();

        $booking = $booking->fresh(['telematicsTrip', 'telematicsSetupSession', 'returnRecord', 'assignment', 'assignedDriver']);
        abort_unless(app(TelematicsOperatorService::class)->isOperator($booking, $user), 403);

        return $booking;
    }

    private function session(Booking $booking, User $user, string $id): DriveMonitoringSession
    {
        return DriveMonitoringSession::where('telematics_trip_id', $booking->telematicsTrip?->id ?? 0)
            ->where('user_id', $user->id)->lockForUpdate()->findOrFail($id);
    }
}
