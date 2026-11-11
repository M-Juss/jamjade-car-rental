<?php

namespace App\Services;

use App\Models\DriveMonitoringBatch;
use App\Models\DriveMonitoringSession;
use App\Support\RcNativeProtocol;

/** Caller must authorize and lock the session inside a transaction. */
class DriveMonitoringBatchService
{
    public function receive(DriveMonitoringSession $session, array $input): array
    {
        $hash = hash('sha256', RcNativeProtocol::canonical($input));
        $previous = DriveMonitoringBatch::where('session_id', $session->id)->where('client_batch_id', $input['client_batch_id'])->first();
        if ($previous) {
            abort_unless(hash_equals($previous->content_sha256, $hash), 409, 'The batch contents changed.');

            return $previous->predictions;
        }
        abort_unless($session->status === 'active', 409, 'Monitoring has stopped.');
        abort_unless(min(array_column($input['windows'], 'end_ms')) > $session->last_window_end_ms, 409, 'Monitoring windows arrived out of order.');
        $result = app(RcDemoInferenceService::class)->predict(['version' => $input['version'],
            'windows' => array_map(fn ($w) => ['id' => $w['id'], 'features' => $w['features']], $input['windows'])]);
        app(DriveMonitoringEventService::class)->consume($session, $input['windows'], $result['predictions']);
        app(RentalMotionCoverageService::class)->receive($session, $input['windows']);
        DriveMonitoringBatch::create(['session_id' => $session->id, 'client_batch_id' => $input['client_batch_id'],
            'content_sha256' => $hash, 'predictions' => $result]);

        return $result;
    }
}
