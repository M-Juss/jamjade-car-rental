<?php

use App\Services\RcPilotDatasetExportService;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

beforeEach(function () {
    Storage::fake('local');
    $this->export = app(RcPilotDatasetExportService::class);
    $this->interval = [
        'annotation_index' => 0, 'start_ms' => 10, 'end_ms' => 60, 'movement' => 'braking',
        'direction' => 'forward', 'severity' => 'harsh', 'certainty' => 'reviewed', 'source' => 'operator_report',
        'initial_deviation' => null, 'role' => 'supervised_target', 'target' => 'harsh_braking',
        'selection_basis' => 'reviewed_interval', 'paired_rows' => 2,
    ];
    $this->result = ['config' => ['start_ms' => 0, 'end_ms' => 100], 'rows' => [], 'signals' => [
        'acceleration' => ['after' => [], 'warmup' => []], 'gyroscope' => ['after' => [], 'warmup' => []],
    ]];
    foreach ([0, 20, 40, 60, 80, 100] as $time) {
        $this->result['signals']['acceleration']['after'][] = ['time' => $time, 'x' => -2.5, 'y' => 0.2, 'z' => 0.1];
        $this->result['signals']['gyroscope']['after'][] = ['time' => $time, 'x' => 0.01, 'y' => 0.02, 'z' => 0.03];
        foreach (['acceleration', 'gyroscope'] as $channel) {
            $this->result['signals'][$channel]['warmup'][] = false;
        }
        $this->result['rows'][] = ['time' => $time,
            'acceleration' => ['state' => 'interpolated', 'source_times_ns' => ['9007199254741001', '9007199294741001']],
            'gyroscope' => ['state' => 'original', 'source_times_ns' => ['9007199254741001']],
        ];
    }
});

it('preserves half open intervals, channel order and timestamp strings', function () {
    $exported = $this->export->interval($this->interval, $this->result, 'recording', 'revision');
    expect(array_column($exported['samples'], 0))->toBe([20, 40])
        ->and($exported['samples'][0])->toBe([20, -2.5, 0.2, 0.1, 0.01, 0.02, 0.03])
        ->and($exported['provenance'][0]['acceleration']['source_times_ns'][0])->toBe('9007199254741001')
        ->and($exported['sample_count'])->toBe(2)
        ->and($exported)->not->toHaveKey('target')->and($exported)->not->toHaveKey('code');
});

it('rejects invalid data and conflicting targets', function (string $change) {
    $interval = $this->interval;
    $result = $this->result;
    match ($change) {
        'null' => $result['signals']['acceleration']['after'][1]['x'] = null,
        'warmup' => $result['signals']['gyroscope']['warmup'][1] = true,
        'grid' => $result['signals']['acceleration']['after'][2]['time'] = 41,
        'gap' => $result['rows'][1]['gyroscope']['state'] = 'gap',
        'count' => $interval['paired_rows'] = 3,
        'mapping' => $interval['target'] = 'normal_motion',
        'uncertain' => $interval['certainty'] = 'uncertain',
        'signal_only' => $interval['source'] = 'signal_review',
        'coverage' => $interval['end_ms'] = 120,
    };
    expect(fn () => $this->export->interval($interval, $result, 'recording', 'revision'))->toThrow(RuntimeException::class);
})->with(['null', 'warmup', 'grid', 'gap', 'count', 'mapping', 'uncertain', 'signal_only', 'coverage']);

it('keeps confirmed legacy swerving as its movement target with unknown severity', function () {
    $selection = [...$this->interval, 'movement' => 'swerving', 'target' => 'swerving', 'severity' => 'unknown',
        'certainty' => 'uncertain', 'initial_deviation' => 'left', 'selection_basis' => 'legacy_swerve_movement_confirmed_without_severity'];
    expect($this->export->interval($selection, $this->result, 'recording', 'revision')['sample_count'])->toBe(2);
    $selection['selection_basis'] = 'reviewed_interval';
    expect(fn () => $this->export->interval($selection, $this->result, 'recording', 'revision'))->toThrow(RuntimeException::class);
});

it('maps reviewed obstacle swerves by severity and keeps legacy offset motion as lane change', function () {
    foreach (['normal' => 'normal_swerve', 'harsh' => 'harsh_swerve'] as $severity => $target) {
        $selection = [...$this->interval, 'movement' => 'swerving', 'severity' => $severity,
            'target' => $target, 'initial_deviation' => 'left'];
        expect($this->export->interval($selection, $this->result, 'recording', 'revision')['sample_count'])->toBe(2);
        $selection['target'] = 'lane_change';
        expect(fn () => $this->export->interval($selection, $this->result, 'recording', 'revision'))->toThrow(RuntimeException::class);
    }

    $legacy = [...$this->interval, 'movement' => 'swerving', 'target' => 'lane_change',
        'severity' => 'unknown', 'certainty' => 'uncertain', 'initial_deviation' => 'left',
        'selection_basis' => 'legacy_swerve_movement_confirmed_without_severity'];
    expect($this->export->interval($legacy, $this->result, 'recording', 'revision')['sample_count'])->toBe(2);
    $legacy['selection_basis'] = 'reviewed_interval';
    expect(fn () => $this->export->interval($legacy, $this->result, 'recording', 'revision'))->toThrow(RuntimeException::class);

    $reviewedLegacy = [...$this->interval, 'movement' => 'swerving', 'target' => 'lane_change',
        'severity' => 'normal', 'initial_deviation' => 'right', 'selection_basis' => 'legacy_lane_change_course'];
    expect($this->export->interval($reviewedLegacy, $this->result, 'recording', 'revision')['sample_count'])->toBe(2);
    $reviewedLegacy['selection_basis'] = 'reviewed_interval';
    expect(fn () => $this->export->interval($reviewedLegacy, $this->result, 'recording', 'revision'))->toThrow(RuntimeException::class);
});

it('rejects the historical swerving target in a new mapped snapshot', function () {
    Storage::disk('local')->put('rc-research-v2/datasets/pilot-split-v3.json.encrypted', Crypt::encryptString(json_encode([
        'schema' => 'jamjade-rc-pilot-split-v2',
        'recordings' => [['intervals' => [['movement' => 'swerving', 'target' => 'swerving']]]],
    ], JSON_THROW_ON_ERROR)));
    expect(fn () => $this->export->verify('pilot-split-v3'))->toThrow(RuntimeException::class, 'need a new dataset target mapping');
});

it('keeps stationary context separate from supervised moving targets', function () {
    $selection = [...$this->interval, 'movement' => 'stationary', 'severity' => 'not_applicable',
        'direction' => 'not_applicable', 'target' => null, 'role' => 'stationary_context'];
    expect($this->export->interval($selection, $this->result, 'recording', 'revision')['sample_count'])->toBe(2);
    $selection['target'] = 'normal_motion';
    expect(fn () => $this->export->interval($selection, $this->result, 'recording', 'revision'))->toThrow(RuntimeException::class);
});

it('refuses overlapping sessions before reading recordings or writing an export', function () {
    config(['telematics.calibration_profile' => 'rc_demo']);
    $entry = ['recording_id' => (string) Str::uuid(), 'session_id' => (string) Str::uuid(),
        'mount_id' => (string) Str::uuid(), 'manifest_sha256' => str_repeat('a', 64),
        'processing' => ['reference_run_id' => (string) Str::uuid()], 'partition' => 'development'];
    $other = [...$entry, 'recording_id' => (string) Str::uuid(), 'manifest_sha256' => str_repeat('b', 64), 'partition' => 'final_evaluation'];
    Storage::disk('local')->put('rc-research-v2/datasets/pilot-split-v2.json.encrypted',
        Crypt::encryptString(json_encode(['schema' => 'jamjade-rc-pilot-split-v1', 'recordings' => [$entry, $other]], JSON_THROW_ON_ERROR)));
    expect(fn () => $this->export->export('pilot-split-v2'))->toThrow(RuntimeException::class, 'Development and evaluation evidence overlap.');
    expect(Storage::disk('local')->allDirectories('rc-research-v2/datasets'))->toBe([]);
});

it('rejects path traversal and nonlocal command use', function () {
    expect(fn () => $this->export->export('../pilot-split-v2'))->toThrow(RuntimeException::class, 'Invalid snapshot name.');
    $this->artisan('rc-research:export-pilot')->assertFailed();
});

it('refuses either lateral class in a new snapshot using the historical target mapping', function (string $movement) {
    Storage::disk('local')->put('rc-research-v2/datasets/pilot-split-v3.json.encrypted', Crypt::encryptString(json_encode([
        'schema' => 'jamjade-rc-pilot-split-v1',
        'recordings' => [['intervals' => [['movement' => $movement, 'target' => 'swerving']]]],
    ], JSON_THROW_ON_ERROR)));
    expect(fn () => $this->export->verify('pilot-split-v3'))->toThrow(RuntimeException::class, 'need a new dataset target mapping');
})->with(['lane_change', 'swerving']);

function privatePilotExportFixture(array $selection, array $result): array
{
    $recording = (string) Str::uuid();
    $annotation = (string) Str::uuid();
    $entry = ['recording_id' => $recording, 'session_id' => (string) Str::uuid(), 'mount_id' => (string) Str::uuid(),
        'manifest_sha256' => str_repeat('a', 64), 'processing' => ['reference_run_id' => (string) Str::uuid()],
        'partition' => 'development', 'intervals' => [$selection], 'file' => "development/$recording.json.encrypted",
        'interval_count' => 1, 'sample_count' => 2];
    $snapshot = json_encode(['schema' => 'jamjade-rc-pilot-split-v1', 'recordings' => [$entry]], JSON_THROW_ON_ERROR);
    $root = 'rc-research-v2/datasets';
    $destination = $root.'/exports/pilot-split-v2-'.substr(hash('sha256', $snapshot), 0, 16);
    Storage::disk('local')->put($root.'/pilot-split-v2.json.encrypted', Crypt::encryptString($snapshot));
    $interval = app(RcPilotDatasetExportService::class)->interval($selection, $result, $recording, $annotation);
    $data = json_encode(['recording_id' => $recording, 'intervals' => [$interval]], JSON_THROW_ON_ERROR);
    $ciphertext = Crypt::encryptString($data);
    Storage::disk('local')->put($destination.'/'.$entry['file'], $ciphertext);
    $manifest = ['schema' => RcPilotDatasetExportService::VERSION, 'snapshot_sha256' => hash('sha256', $snapshot),
        'recordings' => [[...$entry, 'ciphertext_sha256' => hash('sha256', $ciphertext)]],
        'summary' => ['development' => ['recordings' => 1, 'intervals' => 1, 'samples' => 2, 'stationary_intervals' => 0,
            'target_intervals' => ['harsh_braking' => 1]]]];
    Storage::disk('local')->put($destination.'/manifest.json.encrypted', Crypt::encryptString(json_encode($manifest, JSON_THROW_ON_ERROR)));

    return ['destination' => $destination, 'file' => $destination.'/'.$entry['file'], 'recording_id' => $recording];
}

it('reads paired interval data through the local stream while files remain encrypted', function () {
    $fixture = privatePilotExportFixture($this->interval, $this->result);
    $this->export->verify('pilot-split-v2');
    $rows = iterator_to_array($this->export->stream('pilot-split-v2', 'development'));
    expect($rows)->toHaveCount(1)
        ->and($rows[0]['target'])->toBe('harsh_braking')
        ->and($rows[0]['samples'])->toHaveCount(2)
        ->and(iterator_to_array($this->export->stream('pilot-split-v2', 'final_evaluation')))->toBe([])
        ->and(Storage::disk('local')->get($fixture['file']))->not->toContain('samples')
        ->and(Storage::disk('local')->get($fixture['destination'].'/manifest.json.encrypted'))->not->toContain('harsh_braking');
});

it('refuses modified files before yielding any training intervals', function () {
    $fixture = privatePilotExportFixture($this->interval, $this->result);
    Storage::disk('local')->append($fixture['file'], 'corrupted');
    expect(fn () => iterator_to_array($this->export->stream('pilot-split-v2', 'development')))
        ->toThrow(RuntimeException::class, 'An export file failed its checksum.');
});

it('requires the same frozen snapshot and rejects unsupported stream partitions', function () {
    privatePilotExportFixture($this->interval, $this->result);
    expect(fn () => iterator_to_array($this->export->stream('pilot-split-v2', 'all')))->toThrow(RuntimeException::class);
    Storage::disk('local')->put('rc-research-v2/datasets/pilot-split-v2.json.encrypted', Crypt::encryptString(json_encode([
        'schema' => 'jamjade-rc-pilot-split-v1', 'recordings' => [],
    ], JSON_THROW_ON_ERROR)));
    expect(fn () => $this->export->verify('pilot-split-v2'))
        ->toThrow(RuntimeException::class, 'The private export file is unavailable.');
});
