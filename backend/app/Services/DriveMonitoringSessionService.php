<?php

namespace App\Services;

use App\Models\DriveMonitoringSession;
use App\Models\RcProcessingRun;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DriveMonitoringSessionService
{
    public function __construct(private readonly RcResearchAccessService $access,
        private readonly RcProcessingRunService $runs, private readonly RcReferenceReuseService $references,
        private readonly DriveMonitoringReferenceService $runtimeReferences) {}

    public function start(User $owner, array $input): DriveMonitoringSession
    {
        return DB::transaction(function () use ($owner, $input) {
            User::whereKey($owner->id)->lockForUpdate()->firstOrFail();
            abort_unless($this->access->enabled() && $owner->is_active && $owner->hasRole('admin'), 403);
            $existing = DriveMonitoringSession::whereNull('telematics_trip_id')->where('user_id', $owner->id)
                ->where('client_session_id', $input['client_session_id'])->first();
            if ($existing) {
                abort_unless($existing->reference_run_id === $input['reference_run_id']
                    && $existing->research_session_id === $input['research_session_id']
                    && $existing->mount_version_id === $input['mount_version_id'], 409, 'Monitoring details changed. Refresh and retry.');

                return $existing;
            }
            if (DriveMonitoringSession::whereNull('telematics_trip_id')->where('user_id', $owner->id)->where('status', 'active')->exists()) {
                throw ValidationException::withMessages(['client_session_id' => 'Stop the active monitoring session first.']);
            }
            $run = RcProcessingRun::whereHas('recording', fn ($query) => $query->where('user_id', $owner->id)
                ->where('state', 'verified')->where('capture_state', 'stopped'))->findOrFail($input['reference_run_id']);
            $problem = $this->references->runProblem($run, $this->runs->result($run));
            if ($problem !== null || $run->cutoff_hz !== 5) {
                throw ValidationException::withMessages(['reference_run_id' => $problem ?? 'Choose a 5 Hz forward reference.']);
            }
            $reference = $this->runtimeReferences->forRun($owner, $run, $input['research_session_id'], $input['mount_version_id']);

            return DriveMonitoringSession::create([
                'user_id' => $owner->id, 'client_session_id' => $input['client_session_id'],
                'reference_run_id' => $run->id, 'status' => 'active',
                'research_session_id' => $input['research_session_id'], 'mount_version_id' => $input['mount_version_id'],
                'runtime_reference' => $reference,
                'model_sha256' => RcDemoInferenceService::MODEL_SHA256, 'consented_at' => now(),
            ]);
        });
    }

    public function stop(User $owner, string $id): DriveMonitoringSession
    {
        return DB::transaction(function () use ($owner, $id) {
            $session = DriveMonitoringSession::whereNull('telematics_trip_id')->where('user_id', $owner->id)->lockForUpdate()->findOrFail($id);
            if ($session->status !== 'stopped') {
                app(DriveMonitoringEventService::class)->finish($session);
                $session->update(['status' => 'stopped', 'ended_at' => now()]);
            }

            return $session;
        });
    }

    public function batch(User $owner, string $id, array $input): array
    {
        return DB::transaction(function () use ($owner, $id, $input) {
            $session = DriveMonitoringSession::whereNull('telematics_trip_id')->where('user_id', $owner->id)->lockForUpdate()->findOrFail($id);
            abort_unless($this->access->enabled() && $owner->is_active && $owner->hasRole('admin'), 403);

            return app(DriveMonitoringBatchService::class)->receive($session, $input);
        });
    }
}
