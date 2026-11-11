<?php

namespace App\Services;

use App\Models\RcNativeRecording;
use App\Models\RcObservationRevision;
use App\Models\RcProcessingRun;
use Symfony\Component\HttpKernel\Exception\HttpException;

class RcRecordingReviewService
{
    public function __construct(private readonly RcNativeResearchService $research, private readonly RcReferenceReuseService $reuse) {}

    public function inspect(RcNativeRecording $record, array $manifest): array
    {
        $context = $record->collectionContext?->payload;
        $legacyLaneChange = $record->collectionContext?->isLegacyLaneChange() ?? false;
        $observation = RcObservationRevision::where('recording_id', $record->id)->latest('revision')->first();
        $runs = RcProcessingRun::where('recording_id', $record->id);
        $referenceStatus = 'not_required';
        $reference = null;
        if (($manifest['context']['recording_kind'] ?? null) === 'maneuver_trial') {
            $referenceStatus = 'missing';
            // Search within the per-owner recording limit.
            $candidates = RcNativeRecording::where('user_id', $record->user_id)->where('state', 'verified')
                ->where('capture_state', 'stopped')->where('id', '!=', $record->id)
                ->where('started_at', '<=', $record->started_at)->latest('started_at')->limit($this->research->recordingLimit())->get();
            foreach ($candidates as $candidate) {
                try {
                    if ($this->reuse->compatibility($record, $manifest, $candidate, $this->research->manifest($candidate)) !== null) {
                        continue;
                    }
                } catch (HttpException $error) {
                    if ($error->getStatusCode() !== 503) {
                        throw $error;
                    }

                    continue;
                }
                $hasRun = RcProcessingRun::where('recording_id', $candidate->id)->whereNull('reference_run_id')->exists();
                if ($reference === null || $hasRun) {
                    $reference = ['id' => $candidate->id, 'name' => $candidate->name];
                    $referenceStatus = $hasRun ? 'review_required' : 'needs_processing';
                }
                if ($hasRun) {
                    break;
                }
            }
        }

        return [
            'collection' => $context ? [
                'display_code' => $record->collectionContext->reviewCode(), 'session_number' => $context['session']['session_number'],
                'mount_number' => $context['mount']['mount_number'], 'protocol_code' => $legacyLaneChange ? 'LC' : $context['protocol_code'],
                'original_protocol_code' => $context['protocol_code'],
                'expected_stop_method' => $context['protocol_snapshot']['expected_stop_method'],
                'preflight_result' => $context['preflight']['result'],
            ] : null,
            'observation' => $observation ? ['revision' => $observation->revision, ...array_intersect_key($observation->payload,
                array_flip(['completed_as_planned', 'source', 'observer_code', 'flags', 'actual_stop_method', 'initial_deviation', 'notes', 'reported_at']))] : null,
            'processing' => ['reference_status' => $referenceStatus, 'reference_recording' => $reference,
                'saved_runs' => (clone $runs)->count(), 'latest_run_id' => (clone $runs)->latest('created_at')->orderByDesc('id')->value('id')],
        ];
    }
}
