<?php

namespace App\Services;

use App\Models\RcNativeRecording;
use App\Models\RcObservationRevision;
use App\Models\RcProcessingRun;
use App\Models\User;
use App\Support\RcNativeProtocol;
use Generator;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class RcPilotDatasetExportService
{
    public const VERSION = 'rc-pilot-interval-export-v1';

    private const PARTITIONS = ['development', 'final_evaluation'];

    // The two frozen experiments used "swerving" for the old lane-change course.
    private const LEGACY_LATERAL_SPLITS = [
        'ca1b1eef3565b06c6e0188b95eac894c14524fdcc8453bc3feeb779ce7fc6d75',
        '4e87301fe430a1ca8f49cce0aa35d8df3c6949091fbbf33872a1a42692b06445',
    ];

    public function __construct(
        private readonly RcNativeResearchService $research,
        private readonly RcProcessingRunService $processing,
        private readonly RcReferenceReuseService $reuse,
        private readonly RcResearchAccessService $access,
    ) {}

    public function export(string $snapshot): array
    {
        [$snapshotJson, $selection, $destination] = $this->snapshot($snapshot);
        $this->ensure($this->access->enabled(), 'Enable the RC pilot profile before exporting.');
        $entries = $selection['recordings'];
        $this->ensure(count($entries) > 0 && count($entries) <= 1000, 'The snapshot recording count is unsupported.');
        $this->validateSplit($entries);
        $stage = $destination.'.pending-'.Str::uuid();
        $this->ensure(mkdir($stage, 0700, true), 'Private export storage is unavailable.');

        try {
            $index = [];
            $owner = null;
            foreach ($entries as $entry) {
                $record = RcNativeRecording::with('collectionContext')->findOrFail($entry['recording_id']);
                $owner ??= $record->user_id;
                $this->ensure($record->user_id === $owner, 'A snapshot must belong to one account.');
                $this->ensure($record->state === 'verified' && $record->capture_state === 'stopped', 'A selected original is incomplete.');
                $this->ensure($record->manifest_sha256 === $entry['manifest_sha256'], 'An original hash changed.');
                $context = $record->collectionContext;
                $this->ensure($context !== null && $context->mount_id === $entry['mount_id']
                    && $context->payload['session']['id'] === $entry['session_id'], 'Collection identity changed.');
                $manifest = $this->research->manifest($record);
                $this->ensure($manifest['chunk_inventory_sha256'] === $entry['chunk_inventory_sha256'], 'An original inventory changed.');
                $annotation = $record->annotationRevisions()->latest('revision')->firstOrFail();
                $observation = RcObservationRevision::where('recording_id', $record->id)->latest('revision')->firstOrFail();
                $this->ensure($annotation->id === $entry['annotation']['id']
                    && $annotation->fingerprint === $entry['annotation']['fingerprint']
                    && $annotation->manifest_sha256 === $record->manifest_sha256
                    && $observation->id === $entry['observation']['id']
                    && $observation->content_sha256 === $entry['observation']['content_sha256'], 'Labels or observations changed. Freeze a new snapshot.');
                $report = $observation->payload;
                $this->ensure($report['completed_as_planned'] === true
                    && ! array_diff($report['flags'], ['steering_corrections']), 'A selected trial has an unresolved deviation.');

                $run = RcProcessingRun::where('recording_id', $record->id)->findOrFail($entry['processing']['id']);
                $this->ensure($run->fingerprint === $entry['processing']['fingerprint']
                    && $run->payload_sha256 === $entry['processing']['payload_sha256']
                    && $run->version === RcMotionProcessing::REUSE_VERSION
                    && $run->reference_run_id === $entry['processing']['reference_run_id'], 'Processing identity changed.');
                $result = $this->processing->result($run);
                $reference = $run->referenceRun()->firstOrFail();
                $referenceRecord = $reference->recording()->firstOrFail();
                $this->ensure($referenceRecord->user_id === $owner, 'Reference ownership differs.');
                $referenceSelection = collect($selection['references'])->sole('processing.id', $reference->id);
                $this->ensure($reference->fingerprint === $referenceSelection['processing']['fingerprint']
                    && $reference->payload_sha256 === $referenceSelection['processing']['payload_sha256']
                    && $referenceRecord->manifest_sha256 === $referenceSelection['manifest_sha256'], 'Reference identity changed.');
                $resolved = $this->reuse->resolve($record, $manifest, $reference, $this->processing->result($reference));
                $this->ensure(RcNativeProtocol::canonical($result['reference_origin']) === RcNativeProtocol::canonical($resolved['origin']), 'Reference dependencies differ.');
                $this->ensure($result['source']['manifest_sha256'] === $record->manifest_sha256
                    && $result['source']['recording_id'] === $record->id
                    && $result['source']['chunk_inventory_sha256'] === $manifest['chunk_inventory_sha256']
                    && $result['settings']['grid_ms'] === 20
                    && $result['config']['cutoff_hz'] === 5, 'Processing source or profile differs.');
                foreach (['accelerometer', 'gyroscope'] as $channel) {
                    $this->research->window($record, $channel, $result['config']['start_ms'], $result['config']['end_ms']);
                }

                $intervals = [];
                foreach ($entry['intervals'] as $selected) {
                    $label = $annotation->intervals[$selected['annotation_index']] ?? null;
                    $this->ensure($label !== null, 'A selected annotation is missing.');
                    foreach (['start_ms', 'end_ms', 'movement', 'direction', 'severity', 'certainty', 'source'] as $field) {
                        $this->ensure($label[$field] == $selected[$field], 'A selected annotation differs from its saved revision.');
                    }
                    $intervals[] = $this->interval($selected, $result, $record->id, $annotation->id);
                }
                $this->ensure($intervals !== [], 'A selected recording has no intervals.');
                $filename = $entry['partition'].'/'.$record->id.'.json.encrypted';
                $this->write($stage.'/'.$filename, ['recording_id' => $record->id, 'intervals' => $intervals]);
                $index[] = [
                    ...$entry, 'file' => $filename, 'ciphertext_sha256' => hash_file('sha256', $stage.'/'.$filename),
                    'interval_count' => count($intervals), 'sample_count' => array_sum(array_column($intervals, 'sample_count')),
                    'settings' => $result['settings'], 'methods' => $result['methods'],
                ];
            }
            $actor = User::findOrFail($owner);
            $this->ensure($actor->is_active && $actor->hasRole('admin'), 'An active Admin must own the dataset.');
            $summary = $this->summary($index);
            $export = [
                'schema' => self::VERSION, 'created_at' => now()->toISOString(), 'snapshot' => $snapshot,
                'snapshot_sha256' => hash('sha256', $snapshotJson), 'owner_id' => $owner,
                'sample_columns' => ['elapsed_ms', 'acceleration_forward', 'acceleration_right', 'acceleration_up',
                    'rotation_forward', 'rotation_right', 'rotation_up'],
                'units' => ['elapsed_ms' => 'ms', 'acceleration' => 'm/s²', 'rotation' => 'rad/s'],
                'model_input_columns' => ['acceleration_forward', 'acceleration_right', 'acceleration_up',
                    'rotation_forward', 'rotation_right', 'rotation_up'],
                'timing_policy' => 'Half-open original elapsed intervals, approximate annotation boundaries. Keep complete intervals. No fixed ML windows or per-interval normalization.',
                'stationary_policy' => 'Stationary intervals are context, with no supervised moving target.',
                'summary' => $summary, 'recordings' => $index,
                'selection' => $selection,
            ];
            $this->write($stage.'/manifest.json.encrypted', $export);
            $this->ensure(! file_exists($destination), 'This snapshot already has an export. Use the existing package or freeze a new snapshot.');
            $this->ensure(rename($stage, $destination), 'Unable to publish the private export.');
            $this->verify($snapshot);

            return ['path' => $destination, 'summary' => $summary];
        } finally {
            if (is_dir($stage)) {
                File::deleteDirectory($stage);
            }
        }
    }

    public function interval(array $selection, array $result, string $recordingId, string $annotationId): array
    {
        $this->validateTarget($selection);
        $start = $selection['start_ms'];
        $end = $selection['end_ms'];
        $this->ensure(is_numeric($start) && is_numeric($end) && $end > $start
            && $start >= $result['config']['start_ms'] && $end <= $result['config']['end_ms'], 'An interval exceeds processing coverage.');
        $samples = $provenance = [];
        $expectedTime = ceil($start / 20) * 20;
        foreach ($result['signals']['acceleration']['after'] as $index => $acceleration) {
            $time = $acceleration['time'];
            if ($time < $start || $time >= $end) {
                continue;
            }
            $gyro = $result['signals']['gyroscope']['after'][$index] ?? [];
            $row = $result['rows'][$index] ?? [];
            $this->ensure($time == $expectedTime, 'An interval has a grid gap or duplicate.');
            $this->ensure(($gyro['time'] ?? null) == $time && ($row['time'] ?? null) == $time
                && ($result['signals']['acceleration']['warmup'][$index] ?? true) === false
                && ($result['signals']['gyroscope']['warmup'][$index] ?? true) === false, 'An interval includes missing or warm-up readings.');
            $values = [$acceleration['x'], $acceleration['y'], $acceleration['z'], $gyro['x'], $gyro['y'], $gyro['z']];
            $this->ensure(count(array_filter($values, fn ($value) => (is_int($value) || is_float($value)) && is_finite($value))) === 6, 'An interval includes invalid readings.');
            foreach (['acceleration', 'gyroscope'] as $channel) {
                $this->ensure(in_array($row[$channel]['state'] ?? null, ['original', 'interpolated'], true)
                    && is_array($row[$channel]['source_times_ns'] ?? null), 'Sample provenance is missing.');
            }
            $samples[] = [$time, ...$values];
            $provenance[] = [
                'acceleration' => array_intersect_key($row['acceleration'], ['state' => true, 'source_times_ns' => true]),
                'gyroscope' => array_intersect_key($row['gyroscope'], ['state' => true, 'source_times_ns' => true]),
            ];
            $expectedTime += 20;
        }
        $expected = (int) ceil($end / 20) - (int) ceil($start / 20);
        $this->ensure($expected > 0 && count($samples) === $expected && $selection['paired_rows'] === $expected, 'An interval has incomplete paired coverage.');

        return [
            'id' => hash('sha256', $recordingId.'|'.$annotationId.'|'.$selection['annotation_index']),
            'annotation_index' => $selection['annotation_index'], 'sample_count' => count($samples),
            'samples' => $samples, 'provenance' => $provenance,
        ];
    }

    public function verify(string $snapshot): array
    {
        [$json, $selection, $destination] = $this->snapshot($snapshot);
        $manifest = $this->read($destination.'/manifest.json.encrypted');
        $this->ensure($manifest['schema'] === self::VERSION && $manifest['snapshot_sha256'] === hash('sha256', $json), 'Export snapshot integrity failed.');
        $this->validateSplit($manifest['recordings']);
        $expectedIds = array_column($selection['recordings'], 'recording_id');
        $actualIds = array_column($manifest['recordings'], 'recording_id');
        $this->ensure($expectedIds === $actualIds, 'The export recording list differs.');
        foreach ($manifest['recordings'] as $entry) {
            $expectedPath = $entry['partition'].'/'.$entry['recording_id'].'.json.encrypted';
            $this->ensure($entry['file'] === $expectedPath, 'Unexpected recording path.');
            $path = $destination.'/'.$expectedPath;
            $this->ensure(is_file($path) && hash_file('sha256', $path) === $entry['ciphertext_sha256'], 'An export file failed its checksum.');
            $data = $this->read($path);
            $this->ensure($data['recording_id'] === $entry['recording_id'] && count($data['intervals']) === count($entry['intervals']), 'Export intervals differ.');
            foreach ($data['intervals'] as $index => $interval) {
                $label = $entry['intervals'][$index];
                $this->ensure($interval['annotation_index'] === $label['annotation_index']
                    && count($interval['samples']) === $label['paired_rows']
                    && count($interval['provenance']) === $label['paired_rows']
                    && $interval['sample_count'] === $label['paired_rows'], 'Export sample counts differ.');
            }
        }
        $this->ensure($this->summary($manifest['recordings']) === $manifest['summary'], 'Export summary differs.');

        return $manifest;
    }

    public function stream(string $snapshot, string $partition): Generator
    {
        $this->ensure(in_array($partition, self::PARTITIONS, true), 'Choose development or final_evaluation.');
        $manifest = $this->verify($snapshot);
        [, , $destination] = $this->snapshot($snapshot);
        foreach ($manifest['recordings'] as $entry) {
            if ($entry['partition'] !== $partition) {
                continue;
            }
            $data = $this->read($destination.'/'.$entry['file']);
            foreach ($data['intervals'] as $index => $interval) {
                $label = $entry['intervals'][$index];
                yield ['interval_id' => $interval['id'], 'recording_id' => $entry['recording_id'],
                    'session_id' => $entry['session_id'], 'role' => $label['role'], 'target' => $label['target'],
                    'start_ms' => $label['start_ms'], 'end_ms' => $label['end_ms'], 'samples' => $interval['samples']];
            }
        }
    }

    /** Bounded development-only reader for the frozen model explainer. */
    public function streamFrozenDevelopment(string $snapshot, string $expectedSnapshotSha256): Generator
    {
        [$json, $selection, $destination] = $this->snapshot($snapshot);
        $sha = hash('sha256', $json);
        $this->ensure(hash_equals($expectedSnapshotSha256, $sha), 'The development snapshot does not match this model.');
        $this->ensure(filesize($destination.'/manifest.json.encrypted') <= 8_388_608, 'Development manifest exceeds its bound.');
        $manifest = $this->read($destination.'/manifest.json.encrypted');
        $this->ensure(($manifest['schema'] ?? null) === self::VERSION
            && ($manifest['snapshot_sha256'] ?? null) === $sha
            && ($manifest['sample_columns'] ?? null) === ['elapsed_ms', 'acceleration_forward', 'acceleration_right', 'acceleration_up',
                'rotation_forward', 'rotation_right', 'rotation_up'], 'Development export identity differs.');
        $this->ensure(array_column($manifest['recordings'], 'recording_id') === array_column($selection['recordings'], 'recording_id'),
            'Development recording list differs from its snapshot.');
        $recordings = 0;
        $examples = 0;
        foreach ($manifest['recordings'] as $entry) {
            $selected = collect($selection['recordings'])->firstWhere('recording_id', $entry['recording_id']);
            $this->ensure($selected !== null && RcNativeProtocol::canonical(array_intersect_key($entry, $selected)) === RcNativeProtocol::canonical($selected),
                'Development recording metadata differs from its snapshot.');
            if (($entry['partition'] ?? null) !== 'development') {
                continue;
            }
            if (++$recordings > 1000 || ($entry['file'] ?? null) !== 'development/'.$entry['recording_id'].'.json.encrypted') {
                throw new RuntimeException('Development export exceeds its bound.');
            }
            $path = $destination.'/'.$entry['file'];
            $this->ensure(filesize($path) <= 4_194_304, 'Development recording exceeds its bound.');
            $this->ensure(is_file($path) && hash_file('sha256', $path) === $entry['ciphertext_sha256'], 'A development recording failed its checksum.');
            $data = $this->read($path);
            $this->ensure(($data['recording_id'] ?? null) === $entry['recording_id']
                && count($data['intervals'] ?? []) === count($entry['intervals'] ?? []), 'Development recording identity differs.');
            foreach ($data['intervals'] as $index => $interval) {
                $label = $entry['intervals'][$index] ?? [];
                if (($label['role'] ?? null) !== 'supervised_target') {
                    continue;
                }
                if (++$examples > 1000 || count($interval['samples'] ?? []) > 1501
                    || count($interval['samples'] ?? []) !== ($interval['sample_count'] ?? null)
                    || ($interval['annotation_index'] ?? null) !== ($label['annotation_index'] ?? null)
                    || count($interval['samples'] ?? []) !== ($label['paired_rows'] ?? null)) {
                    throw new RuntimeException('Development example exceeds its bound or identity.');
                }
                yield ['interval_id' => $interval['id'], 'recording_id' => $entry['recording_id'],
                    'session_id' => $entry['session_id'], 'role' => $label['role'], 'target' => $label['target'],
                    'start_ms' => $label['start_ms'], 'end_ms' => $label['end_ms'], 'samples' => $interval['samples']];
            }
        }
    }

    private function validateTarget(array $selection): void
    {
        $movement = $selection['movement'];
        $severity = $selection['severity'];
        $legacySwerve = $selection['selection_basis'] === 'legacy_swerve_movement_confirmed_without_severity'
            && $movement === 'swerving' && $severity === 'unknown' && $selection['certainty'] === 'uncertain'
            && in_array($selection['initial_deviation'], ['left', 'right'], true);
        $legacyLaneChange = $selection['selection_basis'] === 'legacy_lane_change_course'
            && $movement === 'swerving' && $severity === 'normal' && $selection['certainty'] === 'reviewed'
            && in_array($selection['initial_deviation'], ['left', 'right'], true);
        $this->ensure(in_array($selection['source'], ['operator_report', 'observed'], true)
            && ($legacySwerve || $selection['certainty'] === 'reviewed'), 'An interval has unconfirmed movement.');
        $expected = match (true) {
            $movement === 'stationary' => null,
            $legacySwerve && $selection['target'] === 'swerving' => 'swerving',
            $legacySwerve => 'lane_change',
            $legacyLaneChange => 'lane_change',
            $movement === 'lane_change' && $severity === 'normal' => 'lane_change',
            $movement === 'swerving' && $severity === 'normal' => 'normal_swerve',
            $movement === 'swerving' && $severity === 'harsh' => 'harsh_swerve',
            $severity === 'normal' && in_array($movement, ['acceleration', 'driving', 'braking', 'left_turn', 'right_turn'], true) => 'normal_motion',
            $severity === 'harsh' && $movement === 'acceleration' => 'harsh_acceleration',
            $severity === 'harsh' && $movement === 'braking' => 'harsh_braking',
            $severity === 'harsh' && in_array($movement, ['left_turn', 'right_turn'], true) => 'harsh_cornering',
            default => 'invalid',
        };
        $this->ensure($expected !== 'invalid' && $selection['target'] === $expected
            && $selection['role'] === ($expected === null ? 'stationary_context' : 'supervised_target'), 'A target mapping is invalid.');
    }

    private function validateSplit(array $entries): void
    {
        $identities = [];
        $recordings = [];
        foreach ($entries as $entry) {
            $partition = $entry['partition'];
            $this->ensure(in_array($partition, self::PARTITIONS, true) && Str::isUuid($entry['recording_id']), 'Invalid partition or recording identity.');
            $this->ensure(! isset($recordings[$entry['recording_id']]), 'A recording is duplicated.');
            $recordings[$entry['recording_id']] = true;
            foreach ([$entry['recording_id'], $entry['session_id'], $entry['mount_id'], $entry['manifest_sha256'], $entry['processing']['reference_run_id']] as $id) {
                $this->ensure(! isset($identities[$id]) || $identities[$id] === $partition, 'Development and evaluation evidence overlap.');
                $identities[$id] = $partition;
            }
        }
    }

    private function summary(array $entries): array
    {
        $summary = [];
        foreach ($entries as $entry) {
            $partition = $entry['partition'];
            $summary[$partition] ??= ['recordings' => 0, 'intervals' => 0, 'samples' => 0, 'stationary_intervals' => 0, 'target_intervals' => []];
            $summary[$partition]['recordings']++;
            $summary[$partition]['intervals'] += count($entry['intervals']);
            $summary[$partition]['samples'] += $entry['sample_count'];
            foreach ($entry['intervals'] as $interval) {
                if ($interval['target'] === null) {
                    $summary[$partition]['stationary_intervals']++;
                } else {
                    $target = $interval['target'];
                    $summary[$partition]['target_intervals'][$target] = ($summary[$partition]['target_intervals'][$target] ?? 0) + 1;
                }
            }
        }

        return $summary;
    }

    private function snapshot(string $snapshot): array
    {
        $this->ensure((bool) preg_match('/^pilot-split-v[1-9][0-9]*$/D', $snapshot), 'Invalid snapshot name.');
        $root = Storage::disk('local')->path('rc-research-v2/datasets');
        $json = Crypt::decryptString(file_get_contents($root.'/'.$snapshot.'.json.encrypted'));
        $selection = json_decode($json, true, 64, JSON_THROW_ON_ERROR);
        $sha = hash('sha256', $json);
        $legacy = in_array($sha, self::LEGACY_LATERAL_SPLITS, true);
        $this->ensure(in_array($selection['schema'], ['jamjade-rc-pilot-split-v1', 'jamjade-rc-pilot-split-v2'], true)
            && (! $legacy || $selection['schema'] === 'jamjade-rc-pilot-split-v1'), 'Unsupported snapshot schema or historical target mapping.');
        if (! $legacy) {
            foreach ($selection['recordings'] as $entry) {
                foreach ($entry['intervals'] ?? [] as $interval) {
                    $lateral = in_array($interval['movement'], ['lane_change', 'swerving'], true)
                        || $interval['target'] === 'swerving';
                    $this->ensure(! $lateral || ($selection['schema'] === 'jamjade-rc-pilot-split-v2'
                        && $interval['target'] !== 'swerving'), 'Lane-change and obstacle-avoidance labels need a new dataset target mapping.');
                    if ($selection['schema'] === 'jamjade-rc-pilot-split-v2') {
                        $this->validateTarget($interval);
                    }
                }
            }
        }

        return [$json, $selection, $root.'/exports/'.$snapshot.'-'.substr($sha, 0, 16)];
    }

    private function write(string $path, array $document): void
    {
        $directory = dirname($path);
        $this->ensure(is_dir($directory) || mkdir($directory, 0700, true), 'Private export directory is unavailable.');
        $json = json_encode($document, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
        $ciphertext = Crypt::encryptString($json);
        $this->ensure(file_put_contents($path, $ciphertext, LOCK_EX) === strlen($ciphertext) && chmod($path, 0600), 'Private export write failed.');
    }

    private function read(string $path): array
    {
        $this->ensure(is_file($path) && is_readable($path), 'The private export file is unavailable.');

        return json_decode(Crypt::decryptString(file_get_contents($path)), true, 64, JSON_THROW_ON_ERROR);
    }

    private function ensure(bool $condition, string $message): void
    {
        if (! $condition) {
            throw new RuntimeException($message);
        }
    }
}
