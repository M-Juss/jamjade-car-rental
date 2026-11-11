<?php

use App\Models\RcNativeRecording;
use App\Models\RcProcessingRun;
use App\Services\RcMotionProcessing;
use App\Services\RcNativeResearchService;
use App\Services\RcPilotDatasetExportService;
use App\Services\RcPilotFeatureService;
use App\Services\RcProcessingRunService;
use App\Services\RcReferenceReuseService;
use Illuminate\Contracts\Console\Kernel;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

if (! $app->isLocal()) {
    throw new RuntimeException('Replay requires the local environment.');
}

$manifest = app(RcPilotDatasetExportService::class)->verify('pilot-split-v3');
$processing = app(RcProcessingRunService::class);
$features = app(RcPilotFeatureService::class);

function session10Entries(array $manifest, string $selection): array
{
    $entries = [];
    $reference = RcNativeRecording::with('collectionContext')->where('state', 'verified')
        ->where('capture_state', 'stopped')->where('name', 'like', '%Recording 256')->get()
        ->sole(fn ($record) => $record->collectionContext?->reviewCode() === 'S10-FR-R256');
    $referenceRun = RcProcessingRun::where('recording_id', $reference->id)
        ->where('cutoff_hz', 5)->whereNull('reference_run_id')->sole();
    $context = $reference->collectionContext;
    $session = $context->payload['session']['id'];
    if (in_array($session, array_column($manifest['recordings'], 'session_id'), true)) {
        throw new RuntimeException('The replay session overlaps the frozen pilot dataset.');
    }
    $protocols = match ($selection) {
        'session10-normal' => array_fill_keys([258, 262, 263, 264], 'MD'),
        'session10-swerve' => [266 => 'HSWL', 272 => 'HSWR'],
        'session10-close' => [273 => 'MD', 280 => 'MD'],
        'session10-double-preview' => [286 => 'MD', 287 => 'MD'],
        'session10-double-check' => [289 => 'MD'],
    };
    foreach ($protocols as $number => $protocol) {
        $code = "S10-$protocol-R$number";
        $record = RcNativeRecording::with('collectionContext')->where('user_id', $reference->user_id)
            ->where('state', 'verified')->where('capture_state', 'stopped')
            ->where('name', 'like', "%Recording $number")->get()
            ->sole(fn ($record) => $record->collectionContext?->reviewCode() === $code);
        if ($record->collectionContext->payload['session']['id'] !== $session
            || $record->collectionContext->mount_id !== $context->mount_id) {
            throw new RuntimeException('The mixed drive does not match the session and mount.');
        }
        if (in_array($selection, ['session10-double-preview', 'session10-double-check'], true)) {
            $entries[] = ['code' => $code, 'protocol_code' => $protocol, 'recording_id' => $record->id,
                'preview_reference' => $referenceRun, 'intervals' => []];

            continue;
        }
        $run = RcProcessingRun::where('recording_id', $record->id)->where('cutoff_hz', 5)
            ->where('reference_run_id', $referenceRun->id)->sole();
        $labels = $record->annotationRevisions()->latest('revision')->firstOrFail();
        if ($labels->revision !== 1 || $labels->manifest_sha256 !== $record->manifest_sha256
            || count($labels->intervals) !== ($selection === 'session10-swerve' ? 1 : 2)) {
            throw new RuntimeException('The reviewed mixed-drive intervals differ.');
        }
        $intervals = [];
        foreach ($labels->intervals as $index => $interval) {
            $target = match (true) {
                $selection === 'session10-normal' && $interval['severity'] === 'normal'
                    && in_array($interval['movement'], ['left_turn', 'right_turn'], true) => 'normal_motion',
                $selection === 'session10-close' && $index === 0 && $interval['severity'] === 'harsh'
                    && $interval['movement'] === 'left_turn' => 'harsh_cornering',
                $selection !== 'session10-normal' && $interval['severity'] === 'harsh'
                    && $interval['movement'] === 'swerving'
                    && ($interval['initial_deviation'] ?? null) === ($protocol === 'HSWR' ? 'right' : 'left') => 'harsh_swerve',
                default => null,
            };
            if ($target === null || $interval['certainty'] !== 'reviewed') {
                throw new RuntimeException('The Session 10 replay evidence differs.');
            }
            $intervals[] = [...$interval, 'target' => $target];
        }
        $entries[] = ['code' => $code, 'protocol_code' => $protocol, 'recording_id' => $record->id,
            'processing' => ['id' => $run->id, 'payload_sha256' => $run->payload_sha256],
            'intervals' => $intervals];
    }

    return $entries;
}

$mode = $argv[1] ?? 'development';
$selection = match ($mode) {
    'development' => array_filter($manifest['recordings'], fn ($entry) => $entry['partition'] === 'development'),
    'session10-normal', 'session10-swerve', 'session10-close', 'session10-double-preview',
    'session10-double-check' => session10Entries($manifest, $mode),
    default => throw new RuntimeException('Choose a supported replay selection.'),
};
foreach ($selection as $entry) {
    if (isset($entry['preview_reference'])) {
        $record = RcNativeRecording::findOrFail($entry['recording_id']);
        $research = app(RcNativeResearchService::class);
        $source = $research->manifest($record);
        $ref = $entry['preview_reference'];
        $reference = app(RcReferenceReuseService::class)->resolve($record, $source, $ref, $processing->result($ref));
        $result = app(RcMotionProcessing::class)->calculate(
            $research->window($record, 'accelerometer', 0, $record->duration_ms)['events'],
            $research->window($record, 'gyroscope', 0, $record->duration_ms)['events'],
            $source['started_elapsed_ns'],
            ['start_ms' => 0.0, 'end_ms' => $record->duration_ms, 'cutoff_hz' => 5],
            $reference['reference'],
        );
    } else {
        $run = RcProcessingRun::findOrFail($entry['processing']['id']);
        if ($run->recording_id !== $entry['recording_id']
            || $run->payload_sha256 !== $entry['processing']['payload_sha256']) {
            throw new RuntimeException('A replay processing run differs from the snapshot.');
        }
        $record = $run->recording()->firstOrFail();
        $result = $processing->result($run);
    }
    $acceleration = $result['signals']['acceleration'];
    $gyro = $result['signals']['gyroscope'];
    $samples = [];
    foreach ($acceleration['after'] as $index => $a) {
        $g = $gyro['after'][$index];
        $sample = [$a['time'], $a['x'], $a['y'], $a['z'], $g['x'], $g['y'], $g['z']];
        $valid = $a['time'] === $g['time'] && ! $acceleration['warmup'][$index]
            && ! $gyro['warmup'][$index] && ! in_array(null, $sample, true);
        $samples[] = $valid ? $sample : null;
    }
    $windows = [];
    $validRun = 0;
    foreach ($samples as $index => $sample) {
        $validRun = $sample === null ? 0 : $validRun + 1;
        if ($sample === null || ($index + 1) % 10 !== 0) {
            continue;
        }
        foreach ([20, 40, 80, 160, 280] as $size) {
            if ($validRun < $size) {
                continue;
            }
            $slice = array_slice($samples, $index + 1 - $size, $size);
            $forward = array_column($slice, 1);
            $peakIndex = array_search(min($forward), $forward, true);
            $firstNearby = max(0, $peakIndex - 7);
            $nearby = array_slice($slice, $firstNearby, min($size, $peakIndex + 8) - $firstNearby);
            $windows[] = ['start_ms' => $slice[0][0], 'end_ms' => $sample[0] + 20,
                'features' => array_values($features->extract($slice)), 'yaw' => array_column($slice, 6),
                'braking_evidence' => [
                    'peak_ms' => $slice[$peakIndex][0],
                    'forward_min' => $forward[$peakIndex],
                    'vertical_peak' => max(array_map(abs(...), array_column($nearby, 3))),
                    'pitch_rate_peak' => max(array_map(abs(...), array_column($nearby, 5))),
                ]];
        }
    }
    echo json_encode([
        'code' => $entry['code'], 'protocol' => $entry['protocol_code'],
        'processing_ms' => $result['config']['end_ms'] - $result['config']['start_ms'],
        'processing_end_ms' => $result['config']['end_ms'],
        'original_ms' => $record->duration_ms,
        'starts_at_zero' => (float) $result['config']['start_ms'] === 0.0,
        'valid_ms' => (count($samples) - count(array_keys($samples, null, true))) * 20,
        'labels' => $entry['intervals'], 'windows' => $windows,
    ], JSON_THROW_ON_ERROR), PHP_EOL;
}
