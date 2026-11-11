<?php

namespace App\Services;

use App\Models\RcAnnotationRevision;
use App\Models\RcNativeRecording;
use App\Support\RcNativeProtocol;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RcAnnotationService
{
    public function __construct(private readonly RcNativeResearchService $research) {}

    /** Whole-recording label snapshot; originals and processing runs are never updated. */
    public function save(RcNativeRecording $record, int $reviewer, array $input): RcAnnotationRevision
    {
        return DB::transaction(function () use ($record, $reviewer, $input) {
            $record = RcNativeRecording::whereKey($record->id)->lockForUpdate()->firstOrFail();
            abort_unless($record->user_id === $reviewer, 404);
            abort_unless($record->state === 'verified', 409, 'Finish uploading before reviewing intervals.');
            $this->research->manifest($record);
            $items = [];
            foreach ($input['intervals'] as $index => $item) {
                if ($item['end_ms'] > $record->duration_ms) {
                    throw ValidationException::withMessages(["intervals.$index.end_ms" => 'The interval extends beyond this recording.']);
                }
                $items[] = ['start_ms' => (float) $item['start_ms'], 'end_ms' => (float) $item['end_ms'],
                    'movement' => $item['movement'], 'direction' => $item['direction'], 'severity' => $item['severity'],
                    'certainty' => $item['certainty'], 'source' => $item['source'], 'notes' => $item['notes'] ?? '',
                    ...array_intersect_key($item, ['initial_deviation' => true])];
            }
            $fingerprint = hash('sha256', RcNativeProtocol::canonical(['version' => 'rc-phase-labels-v1',
                'manifest_sha256' => $record->manifest_sha256, 'intervals' => $items]));
            $current = $record->annotationRevisions()->orderByDesc('revision')->first();
            if ($current && hash_equals($current->fingerprint, $fingerprint)) {
                return $current;
            }
            abort_unless(($current?->revision ?? 0) === (int) $input['base_revision'], 409, 'Labels changed. Reload the latest revision before saving.');
            abort_if(($current?->revision ?? 0) >= 1000, 409, 'Annotation revision limit reached.');
            $swerve = array_search('swerving', array_column($items, 'movement'), true);
            if ($swerve !== false && $record->collectionContext?->isLegacyLaneChange()) {
                throw ValidationException::withMessages(["intervals.$swerve.movement" => 'Use Lane Change for the original offset course.']);
            }

            return RcAnnotationRevision::create(['recording_id' => $record->id, 'reviewer_id' => $reviewer,
                'revision' => ($current?->revision ?? 0) + 1, 'state' => $items === [] ? 'unlabeled'
                    : (in_array('uncertain', array_column($items, 'certainty'), true) ? 'uncertain' : 'reviewed'),
                'manifest_sha256' => $record->manifest_sha256, 'fingerprint' => $fingerprint, 'intervals' => $items]);
        });
    }
}
