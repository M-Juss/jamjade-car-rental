<?php

namespace App\Services;

use App\Support\RcNativeProtocol;
use Generator;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class RcPilotFeatureService
{
    public const VERSION = 'rc-interval-statistics-v1';

    private const CHANNELS = ['acceleration_forward', 'acceleration_right', 'acceleration_up',
        'rotation_forward', 'rotation_right', 'rotation_up'];

    private const STATISTICS = ['mean', 'std', 'min', 'max', 'rms'];

    public function __construct(private readonly RcPilotDatasetExportService $export) {}

    public function definition(): array
    {
        $columns = [];
        foreach (self::CHANNELS as $channel) {
            foreach (self::STATISTICS as $statistic) {
                $columns[] = $channel.'_'.$statistic;
            }
        }

        return ['version' => self::VERSION, 'feature_columns' => $columns,
            'sample_columns' => ['elapsed_ms', ...self::CHANNELS],
            'statistics' => ['mean' => 'arithmetic mean', 'std' => 'population standard deviation (ddof=0), Welford',
                'min' => 'signed minimum', 'max' => 'signed maximum', 'rms' => 'sqrt(mean(value squared))'],
            'units' => ['acceleration' => 'm/s²', 'rotation' => 'rad/s'],
            'representation' => 'One complete manually labeled interval per example; offline isolated-event baseline only.',
            'excluded_inputs' => ['elapsed_ms', 'duration_ms', 'sample_count', 'recording_id', 'session_id',
                'interval_id', 'target', 'code', 'surface', 'protocol', 'direction', 'severity', 'notes'],
            'normalization' => 'none', 'balancing' => 'none', 'grid_ms' => 20];
    }

    /** Pure measured-value transform, independent of labels and identities. */
    public function extract(array $samples): array
    {
        $count = count($samples);
        $this->ensure(array_is_list($samples) && $count > 0 && $count <= 1501, 'Unsupported feature sample count.');
        $means = $m2 = $squares = array_fill(0, 6, 0.0);
        $minima = array_fill(0, 6, INF);
        $maxima = array_fill(0, 6, -INF);
        $last = null;
        foreach ($samples as $index => $sample) {
            $this->ensure(is_array($sample) && array_is_list($sample) && count($sample) === 7, 'A feature reading must contain time and six channels.');
            foreach ($sample as $value) {
                $this->ensure((is_int($value) || is_float($value)) && is_finite($value), 'A feature reading is not finite.');
            }
            $this->ensure($last === null || $sample[0] - $last == 20, 'Feature readings must use a complete 20 ms grid.');
            $last = $sample[0];
            foreach (self::CHANNELS as $axis => $channel) {
                $value = $sample[$axis + 1];
                $delta = $value - $means[$axis];
                $means[$axis] += $delta / ($index + 1);
                $m2[$axis] += $delta * ($value - $means[$axis]);
                $squares[$axis] += $value ** 2;
                $minima[$axis] = min($minima[$axis], $value);
                $maxima[$axis] = max($maxima[$axis], $value);
            }
        }
        $features = [];
        foreach (self::CHANNELS as $axis => $channel) {
            $values = [$means[$axis], sqrt(max(0, $m2[$axis] / $count)), $minima[$axis], $maxima[$axis], sqrt($squares[$axis] / $count)];
            foreach (self::STATISTICS as $index => $statistic) {
                $this->ensure(is_finite($values[$index]), 'Feature calculation overflowed.');
                $features[$channel.'_'.$statistic] = $values[$index];
            }
        }

        return $features;
    }

    public function create(string $snapshot): array
    {
        [$manifest, $source, $path] = $this->source($snapshot);
        $this->ensure(! file_exists($path), 'This feature package already exists. Use --verify or freeze a new feature version.');
        $examples = $context = [];
        $seen = [];
        foreach ($this->export->stream($snapshot, 'development') as $interval) {
            $this->ensure(! isset($seen[$interval['interval_id']]), 'A feature interval is duplicated.');
            $seen[$interval['interval_id']] = true;
            $row = $this->row($interval);
            if ($row['target'] === null) {
                $context[] = $row;
            } else {
                $examples[] = $row;
            }
        }
        $summary = $this->summary($examples, $context);
        $expected = $manifest['summary']['development'];
        $this->ensure($summary['examples'] === $expected['intervals'] - $expected['stationary_intervals']
            && $summary['stationary_context'] === $expected['stationary_intervals']
            && $summary['classes'] === $expected['target_intervals'], 'Feature selection counts differ from the export.');
        $document = ['schema' => self::VERSION, 'created_at' => now()->toISOString(), 'source' => $source,
            'definition' => $this->definition(), 'summary' => $summary, 'examples' => $examples, 'stationary_context' => $context];
        $directory = dirname($path);
        $this->ensure(is_dir($directory) || mkdir($directory, 0700, true), 'Private feature storage is unavailable.');
        $stage = $directory.'/.pending-'.Str::uuid();
        $this->ensure(mkdir($stage, 0700), 'Private feature staging is unavailable.');
        try {
            $ciphertext = Crypt::encryptString(json_encode($document, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION));
            $file = $stage.'/development.json.encrypted';
            $this->ensure(file_put_contents($file, $ciphertext, LOCK_EX) === strlen($ciphertext) && chmod($file, 0600), 'Private feature write failed.');
            // A hard link publishes atomically and refuses to replace an existing package.
            $this->ensure(link($file, $path), 'Unable to publish the private feature package.');
        } finally {
            File::deleteDirectory($stage);
        }

        return $this->verify($snapshot);
    }

    public function verify(string $snapshot): array
    {
        [, $source, $path] = $this->source($snapshot);
        $this->ensure(is_file($path) && is_readable($path), 'The private feature package is unavailable.');
        $document = json_decode(Crypt::decryptString(file_get_contents($path)), true, 64, JSON_THROW_ON_ERROR);
        $this->ensure($document['schema'] === self::VERSION
            && RcNativeProtocol::canonical($document['source']) === RcNativeProtocol::canonical($source)
            && RcNativeProtocol::canonical($document['definition']) === RcNativeProtocol::canonical($this->definition()), 'Feature provenance or definition changed.');
        $rows = array_merge($document['examples'], $document['stationary_context']);
        $indexed = [];
        foreach ($rows as $row) {
            $this->ensure(! isset($indexed[$row['interval_id']]), 'A feature interval is duplicated.');
            $indexed[$row['interval_id']] = $row;
        }
        $count = 0;
        foreach ($this->export->stream($snapshot, 'development') as $interval) {
            $expected = $this->row($interval);
            $this->ensure(RcNativeProtocol::canonical($indexed[$interval['interval_id']] ?? null)
                === RcNativeProtocol::canonical($expected), 'Feature values differ from the exported measurements.');
            $count++;
        }
        $this->ensure(count($indexed) === $count
            && $this->summary($document['examples'], $document['stationary_context']) === $document['summary'], 'Feature package counts differ.');

        return $document;
    }

    public function stream(string $snapshot): Generator
    {
        $document = $this->verify($snapshot);
        foreach ($document['examples'] as $row) {
            yield ['interval_id' => $row['interval_id'], 'recording_id' => $row['recording_id'],
                'session_id' => $row['session_id'], 'target' => $row['target'], 'features' => $row['features']];
        }
    }

    private function row(array $interval): array
    {
        $context = $interval['role'] === 'stationary_context';
        $this->ensure(($context && $interval['target'] === null)
            || ($interval['role'] === 'supervised_target' && in_array($interval['target'],
                ['normal_motion', 'harsh_acceleration', 'harsh_braking', 'harsh_cornering', 'swerving',
                    'lane_change', 'normal_swerve', 'harsh_swerve'], true)), 'Invalid feature interval role or target.');
        $start = $interval['start_ms'];
        $end = $interval['end_ms'];
        $samples = $interval['samples'];
        $this->ensure(is_numeric($start) && is_numeric($end) && $end > $start && $samples !== [], 'Invalid feature interval bounds.');
        $expected = (int) ceil($end / 20) - (int) ceil($start / 20);
        $this->ensure(count($samples) === $expected && $samples[0][0] == ceil($start / 20) * 20
            && $samples[count($samples) - 1][0] < $end, 'Feature interval coverage differs.');

        return ['interval_id' => $interval['interval_id'], 'recording_id' => $interval['recording_id'],
            'session_id' => $interval['session_id'], 'target' => $interval['target'],
            'metadata' => ['role' => $interval['role'], 'start_ms' => $start, 'end_ms' => $end,
                'duration_ms' => $end - $start, 'sample_count' => count($samples)],
            'features' => $this->extract($samples)];
    }

    private function source(string $snapshot): array
    {
        $manifest = $this->export->verify($snapshot);
        $this->ensure($manifest['sample_columns'] === $this->definition()['sample_columns']
            && $manifest['model_input_columns'] === self::CHANNELS, 'Unsupported export channel order.');
        $files = [];
        foreach ($manifest['recordings'] as $entry) {
            if ($entry['partition'] === 'development') {
                $files[] = ['recording_id' => $entry['recording_id'], 'ciphertext_sha256' => $entry['ciphertext_sha256']];
            }
        }
        $this->ensure($files !== [], 'No development recordings are available.');
        $source = ['snapshot' => $snapshot, 'snapshot_sha256' => $manifest['snapshot_sha256'],
            'export_schema' => $manifest['schema'], 'partition' => 'development', 'files' => $files];
        $fingerprint = hash('sha256', RcNativeProtocol::canonical(['source' => $source, 'definition' => $this->definition()]));
        $path = Storage::disk('local')->path('rc-research-v2/datasets/features/'.$fingerprint.'/development.json.encrypted');

        return [$manifest, $source, $path];
    }

    private function summary(array $examples, array $context): array
    {
        $classes = [];
        foreach ($examples as $example) {
            $this->ensure($example['target'] !== null, 'Stationary context cannot enter moving targets.');
            $classes[$example['target']] = ($classes[$example['target']] ?? 0) + 1;
        }
        foreach ($context as $row) {
            $this->ensure($row['target'] === null, 'A moving target cannot enter stationary context.');
        }

        return ['examples' => count($examples), 'stationary_context' => count($context),
            'features' => count($this->definition()['feature_columns']), 'classes' => $classes,
            'recordings' => count(array_unique(array_column(array_merge($examples, $context), 'recording_id')))];
    }

    private function ensure(bool $condition, string $message): void
    {
        if (! $condition) {
            throw new RuntimeException($message);
        }
    }
}
