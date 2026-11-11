<?php

namespace App\Services;

use App\Models\RcNativeRecording;
use App\Models\RcProcessingRun;
use App\Models\User;
use App\Support\RcNativeProtocol;

class DriveMonitoringReferenceService
{
    public function __construct(private RcNativeResearchService $research, private RcProcessingRunService $runs,
        private RcReferenceReuseService $reuse, private RcMotionProcessing $motion) {}

    public function latest(User $owner, string $session, string $mount): array
    {
        $run = RcProcessingRun::whereNull('reference_run_id')->where('cutoff_hz', 5)
            ->whereHas('recording', fn ($q) => $q->where('user_id', $owner->id)->where('state', 'verified')
                ->where('capture_state', 'stopped')->whereHas('collectionContext', fn ($c) => $c->where('mount_id', $mount)->where('display_code', 'like', '%-FR-%')))
            ->latest()->firstOrFail();

        return ['reference_run_id' => $run->id, 'reference' => $this->forRun($owner, $run, $session, $mount)];
    }

    public function forRun(User $owner, RcProcessingRun $run, string $session, string $mount): array
    {
        $record = RcNativeRecording::where('user_id', $owner->id)->where('state', 'verified')
            ->where('capture_state', 'stopped')->findOrFail($run->recording_id);
        $manifest = $this->research->manifest($record);
        abort_unless(($manifest['context']['recording_kind'] ?? null) === 'forward_reference'
            && ($manifest['collection_binding']['research_session_id'] ?? null) === $session
            && ($manifest['collection_binding']['mount_version_id'] ?? null) === $mount, 422,
            'Prepare a forward reference for this session and mount.');
        $payload = $this->runs->result($run);
        abort_unless($run->cutoff_hz === 5 && $this->reuse->runProblem($run, $payload) === null, 422, 'Prepare a 5 Hz forward reference.');
        abort_unless(($payload['source']['recording_id'] ?? null) === $record->id
            && ($payload['source']['manifest_sha256'] ?? null) === $record->manifest_sha256
            && ($payload['source']['chunk_inventory_sha256'] ?? null) === $manifest['chunk_inventory_sha256'], 409, 'Reference source changed.');
        $config = $payload['config'];
        $a = $this->research->window($record, 'accelerometer', $config['start_ms'], $config['end_ms'])['events'];
        $g = $this->research->window($record, 'gyroscope', $config['start_ms'], $config['end_ms'])['events'];
        $reference = $this->motion->calculate($a, $g, $manifest['started_elapsed_ns'], $config)['reference'];
        $result = [];
        foreach (['rotation_rfu', 'acceleration_mean', 'gyroscope_mean'] as $field) {
            abort_unless(RcNativeProtocol::canonical($reference[$field]) === RcNativeProtocol::canonical($payload['reference'][$field] ?? null), 409, 'Reference calculation changed.');
            $result[$field] = $reference[$field];
        }

        return $result;
    }
}
