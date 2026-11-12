<?php

namespace App\Services;

use App\Models\RcNativeRecording;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class RcManeuverComparisonService
{
    private const GRID_MS = 20;

    public function __construct(private readonly RcProcessingRunService $processing) {}

    public function index(User $owner): array
    {
        $recordings = $events = [];
        foreach ($this->recordings($owner)->with($this->processingRuns())->lazyById(25) as $recording) {
            $intervals = $this->reviewedIntervals($recording);
            if ($intervals === []) {
                continue;
            }

            $context = $recording->collectionContext;
            $session = $context?->payload['session'] ?? [];
            $contact = $this->contact($recording);
            $recordings[] = [
                'id' => $recording->id, 'name' => $context?->reviewCode() ?? $recording->name,
                'surface' => $recording->surface, 'session_id' => $session['id'] ?? null,
                'session_number' => $session['session_number'] ?? null, 'duration_ms' => $recording->duration_ms,
                'observation_revision_id' => $recording->latestObservation?->id,
                'first_contact_ms' => $contact['time'], 'contact_status' => $contact['status'],
            ];

            $measurements = $this->measure($recording, $intervals, $contact);
            foreach ($intervals as $index => $interval) {
                $events[] = [
                    'recording_id' => $recording->id, 'annotation_id' => $recording->latestAnnotation->id,
                    'index' => $index, ...$interval, 'measurements' => $measurements[$index] ?? null,
                ];
            }
        }

        return ['recordings' => $recordings, 'events' => $events];
    }

    public function signal(User $owner, string $id, string $annotation, int $index): array
    {
        $recording = $this->recordings($owner)->with($this->processingRuns())->findOrFail($id);
        abort_unless($recording->latestAnnotation?->id === $annotation, 409, 'The reviewed intervals changed. Refresh the comparison.');
        $interval = $this->reviewedIntervals($recording)[$index] ?? null;
        abort_unless($interval, 404);
        $signals = $this->measure($recording, [$index => $interval], $this->contact($recording), true);
        abort_unless(isset($signals[$index]), 409, 'This interval is unavailable. Refresh the comparison.');

        return ['samples' => $signals[$index]];
    }

    public function saveContact(User $owner, string $id, array $input): void
    {
        DB::transaction(function () use ($owner, $id, $input) {
            $recording = $this->recordings($owner)->lockForUpdate()->findOrFail($id);
            abort_unless($this->reviewedIntervals($recording) !== [], 404);
            abort_unless($recording->latestObservation?->id === $input['observation_revision_id'], 409,
                'Observations changed. Refresh before saving.');
            $time = $input['first_contact_ms'];
            if ($time !== null && $time > $recording->duration_ms) {
                throw ValidationException::withMessages(['first_contact_ms' => 'Enter a time within the recording.']);
            }

            if ($time === null) {
                $recording->maneuverContactReview()->delete();
            } else {
                $recording->maneuverContactReview()->updateOrCreate([], [
                    'observation_revision_id' => $input['observation_revision_id'], 'first_contact_ms' => $time,
                ]);
            }
        });
    }

    private function recordings(User $owner): Builder
    {
        abort_unless($owner->is_active && $owner->hasRole('admin'), 403);

        return RcNativeRecording::where('state', 'verified')
            ->whereHas('latestAnnotation')->with([
                'latestAnnotation' => fn ($query) => $query->addSelect(['rc_annotation_revisions.intervals', 'rc_annotation_revisions.manifest_sha256']),
                'latestObservation' => fn ($query) => $query->addSelect('rc_observation_revisions.payload'),
                'maneuverContactReview',
                'collectionContext',
            ]);
    }

    private function reviewedIntervals(RcNativeRecording $recording): array
    {
        $annotation = $recording->latestAnnotation;
        if (! $annotation || $annotation->manifest_sha256 !== $recording->manifest_sha256) {
            return [];
        }

        $intervals = [];
        foreach ($annotation->intervals as $index => $label) {
            $maneuver = match ($label['movement']) {
                'left_turn', 'right_turn' => 'cornering',
                'acceleration', 'braking' => $label['movement'],
                'swerving' => $recording->collectionContext && ! $recording->collectionContext->isLegacyLaneChange() ? 'swerving' : null,
                default => null,
            };
            if ($maneuver === null || $label['certainty'] !== 'reviewed' || ! in_array($label['severity'], ['normal', 'harsh'], true)) {
                continue;
            }
            $intervals[$index] = [
                'maneuver' => $maneuver, 'severity' => $label['severity'],
                'direction' => match ($maneuver) {
                    'cornering' => explode('_', $label['movement'])[0],
                    'swerving' => $label['initial_deviation'] ?? 'unknown',
                    default => $label['direction'],
                },
                'travel_direction' => $label['direction'], 'start_ms' => (float) $label['start_ms'], 'end_ms' => (float) $label['end_ms'],
            ];
        }

        return $intervals;
    }

    private function contact(RcNativeRecording $recording): array
    {
        $observation = $recording->latestObservation;
        $flags = $observation?->payload['flags'] ?? [];
        $review = $recording->maneuverContactReview;
        $status = match (true) {
            $review && $review->observation_revision_id !== $observation?->id => 'review_needed',
            $review !== null => 'confirmed',
            (bool) array_intersect($flags, ['bump', 'cone_contact']) => 'review_needed',
            default => 'unflagged',
        };

        return [
            'status' => $status, 'time' => $review?->first_contact_ms,
            'blocked' => $status === 'review_needed',
        ];
    }

    private function measure(RcNativeRecording $recording, array $intervals, array $contact, bool $returnSignals = false): array
    {
        if ($contact['blocked']) {
            return [];
        }
        $remaining = array_filter($intervals, fn ($interval) => $contact['time'] === null || $interval['end_ms'] < $contact['time']);
        if ($remaining === []) {
            return [];
        }

        $results = [];
        foreach ($recording->processingRuns as $run) {
            try {
                $result = $this->processing->result($run);
            } catch (HttpException $exception) {
                if ($exception->getStatusCode() !== 503) {
                    throw $exception;
                }

                continue;
            }
            if (($result['source']['recording_id'] ?? null) !== $recording->id
                || ($result['source']['manifest_sha256'] ?? null) !== $recording->manifest_sha256
                || ($result['settings']['grid_ms'] ?? null) !== self::GRID_MS) {
                continue;
            }
            foreach ($remaining as $index => $interval) {
                $samples = $this->samples($result, $interval, $contact['time']);
                if ($samples === []) {
                    continue;
                }
                $results[$index] = $returnSignals ? $samples : $this->metrics($interval, $samples);
                unset($remaining[$index]);
            }
            if ($remaining === []) {
                break;
            }
        }

        return $results;
    }

    private function processingRuns(): array
    {
        return ['processingRuns' => fn ($query) => $query->where('version', RcMotionProcessing::REUSE_VERSION)
            ->where('cutoff_hz', 5)->whereNotNull('reference_run_id')->latest('created_at')->orderByDesc('id')];
    }

    private function samples(array $result, array $interval, ?int $contact): array
    {
        $start = $interval['start_ms'];
        $end = $interval['end_ms'];
        $runStart = $result['config']['start_ms'];
        if ($start < $runStart || $end > $result['config']['end_ms']) {
            return [];
        }

        $gridStart = (int) ceil(round($runStart * 1e6) / (self::GRID_MS * 1e6));
        $first = (int) ceil($start / self::GRID_MS);
        $last = (int) ceil($end / self::GRID_MS);
        $samples = [];
        for ($grid = $first; $grid < $last; $grid++) {
            $index = $grid - $gridStart;
            $time = $grid * self::GRID_MS;
            $row = $result['rows'][$index] ?? [];
            if (($row['time'] ?? null) != $time || ! isset($row['sensor_timestamp_ns'])) {
                return [];
            }
            $sample = [($time - $start) / 1000];
            foreach (['acceleration', 'gyroscope'] as $channel) {
                $reading = $result['signals'][$channel]['after'][$index] ?? [];
                $sources = $row[$channel]['source_times_ns'] ?? [];
                if (($reading['time'] ?? null) != $time || ($result['signals'][$channel]['warmup'][$index] ?? true) !== false
                    || ! in_array($row[$channel]['state'] ?? null, ['original', 'interpolated'], true)
                    || ! isset($sources[1])) {
                    return [];
                }
                if ($contact !== null && (int) $sources[1] - (int) $row['sensor_timestamp_ns'] >= ($contact - $time) * 1000000) {
                    return [];
                }
                foreach (['x', 'y', 'z'] as $axis) {
                    $value = $reading[$axis] ?? null;
                    if ((! is_int($value) && ! is_float($value)) || ! is_finite($value)) {
                        return [];
                    }
                    $sample[] = $value;
                }
            }
            $samples[] = $sample;
        }

        return $samples;
    }

    private function metrics(array $interval, array $samples): array
    {
        $duration = ($interval['end_ms'] - $interval['start_ms']) / 1000;
        if (in_array($interval['maneuver'], ['cornering', 'swerving'], true)) {
            return [
                'peak_turn_rate' => max(array_map('abs', array_column($samples, 6))),
                'peak_lateral_acceleration' => max(array_map('abs', array_column($samples, 2))),
                'duration' => $duration,
            ];
        }
        $sign = ($interval['travel_direction'] === 'reverse' ? -1 : 1) * ($interval['maneuver'] === 'braking' ? -1 : 1);

        return [
            'peak_longitudinal_acceleration' => max(0, max(array_map(fn ($sample) => $sample[1] * $sign, $samples))),
            'duration' => $duration,
        ];
    }
}
