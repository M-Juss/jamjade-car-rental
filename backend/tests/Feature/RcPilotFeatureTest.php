<?php

use App\Services\RcPilotDatasetExportService;
use App\Services\RcPilotFeatureService;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('local');
    $this->features = app(RcPilotFeatureService::class);
    $this->samples = [[0, -3, 2, 0, 0.1, -0.2, 0.3], [20, 1, 2, 0, 0.1, -0.2, 0.3]];
});

it('calculates signed peaks, population variation and RMS in a stable thirty-column order', function () {
    $values = $this->features->extract($this->samples);
    expect(array_keys($values))->toBe($this->features->definition()['feature_columns'])
        ->and($values)->toHaveCount(30)
        ->and($values['acceleration_forward_mean'])->toBe(-1.0)
        ->and($values['acceleration_forward_std'])->toBe(2.0)
        ->and($values['acceleration_forward_min'])->toBe(-3)
        ->and($values['acceleration_forward_max'])->toBe(1)
        ->and($values['acceleration_forward_rms'])->toEqualWithDelta(sqrt(5), 1e-12)
        ->and($values['acceleration_right_std'])->toBe(0.0)
        ->and($values['rotation_up_rms'])->toEqualWithDelta(0.3, 1e-12);
});

it('preserves physical amplitude and ignores absolute elapsed time', function () {
    $shifted = $scaled = $this->samples;
    foreach ($shifted as &$sample) {
        $sample[0] += 1000000;
    }
    unset($sample);
    foreach ($scaled as &$sample) {
        for ($axis = 1; $axis <= 6; $axis++) {
            $sample[$axis] *= 2;
        }
    }
    unset($sample);
    $original = $this->features->extract($this->samples);
    expect($this->features->extract($shifted))->toBe($original);
    foreach ($this->features->extract($scaled) as $name => $value) {
        expect($value)->toEqualWithDelta(2 * $original[$name], 1e-12);
    }
});

it('rejects incomplete, nonfinite, malformed or overflowing readings', function (string $failure) {
    $samples = $this->samples;
    match ($failure) {
        'empty' => $samples = [],
        'gap' => $samples[1][0] = 40,
        'duplicate' => $samples[1][0] = 0,
        'backwards' => $samples[1][0] = -20,
        'null' => $samples[0][1] = null,
        'nan' => $samples[0][1] = NAN,
        'string' => $samples[0][1] = '1',
        'shape' => array_pop($samples[0]),
        'overflow' => $samples[0][1] = PHP_FLOAT_MAX,
    };
    expect(fn () => $this->features->extract($samples))->toThrow(RuntimeException::class);
})->with(['empty', 'gap', 'duplicate', 'backwards', 'null', 'nan', 'string', 'shape', 'overflow']);

function pilotFeatureFixture(array $samples, string $secondTarget = 'harsh_braking'): array
{
    $service = app(RcPilotFeatureService::class);
    $manifest = ['schema' => RcPilotDatasetExportService::VERSION, 'snapshot_sha256' => str_repeat('a', 64),
        'sample_columns' => $service->definition()['sample_columns'],
        'model_input_columns' => array_slice($service->definition()['sample_columns'], 1),
        'recordings' => [
            ['partition' => 'development', 'recording_id' => 'recording-a', 'ciphertext_sha256' => str_repeat('b', 64)],
            ['partition' => 'development', 'recording_id' => 'recording-b', 'ciphertext_sha256' => str_repeat('c', 64)],
            ['partition' => 'final_evaluation', 'recording_id' => 'reserved', 'ciphertext_sha256' => str_repeat('d', 64)],
        ],
        'summary' => ['development' => ['intervals' => 3, 'stationary_intervals' => 1,
            'target_intervals' => ['normal_motion' => 1, $secondTarget => 1]]]];
    $base = ['recording_id' => 'recording-a', 'session_id' => 'session-a', 'role' => 'supervised_target',
        'start_ms' => 0, 'end_ms' => 40, 'samples' => $samples];
    $rows = [
        [...$base, 'interval_id' => 'first', 'target' => 'normal_motion'],
        [...$base, 'interval_id' => 'second', 'recording_id' => 'recording-b', 'session_id' => 'session-b', 'target' => $secondTarget],
        [...$base, 'interval_id' => 'third', 'role' => 'stationary_context', 'target' => null],
    ];
    $export = Mockery::mock(RcPilotDatasetExportService::class);
    $export->shouldReceive('verify')->with('pilot-split-v2')->andReturn($manifest);
    $export->shouldReceive('stream')->with('pilot-split-v2', 'development')->andReturnUsing(function () use ($rows) {
        yield from $rows;
    });

    // No final_evaluation stream is allowed by this mock.
    return ['service' => new RcPilotFeatureService($export), 'manifest' => $manifest, 'rows' => $rows];
}

it('writes encrypted development examples and keeps stationary context and metadata out of model inputs', function () {
    $fixture = pilotFeatureFixture($this->samples);
    $document = $fixture['service']->create('pilot-split-v2');
    expect($document['summary'])->toBe(['examples' => 2, 'stationary_context' => 1, 'features' => 30,
        'classes' => ['normal_motion' => 1, 'harsh_braking' => 1], 'recordings' => 2]);
    $rows = iterator_to_array($fixture['service']->stream('pilot-split-v2'));
    expect($rows)->toHaveCount(2)
        ->and($rows[0]['features'])->not->toHaveKeys(['target', 'session_id', 'duration_ms', 'sample_count', 'elapsed_ms'])
        ->and($rows[0])->not->toHaveKey('metadata');
    $files = Storage::disk('local')->allFiles('rc-research-v2/datasets/features');
    expect($files)->toHaveCount(1)
        ->and(Storage::disk('local')->get($files[0]))->not->toContain('normal_motion')
        ->and($document['source']['files'])->toHaveCount(2);
    expect(fn () => $fixture['service']->create('pilot-split-v2'))
        ->toThrow(RuntimeException::class, 'This feature package already exists. Use --verify or freeze a new feature version.');
});

it('extracts the unchanged measured features for new lane-change and swerve targets', function (string $target) {
    $fixture = pilotFeatureFixture($this->samples, $target);
    $document = $fixture['service']->create('pilot-split-v2');
    expect($document['summary']['classes'])->toBe(['normal_motion' => 1, $target => 1])
        ->and($document['definition']['feature_columns'])->toBe($this->features->definition()['feature_columns']);
})->with(['lane_change', 'normal_swerve', 'harsh_swerve']);

it('recomputes features and refuses a modified value before streaming', function () {
    $fixture = pilotFeatureFixture($this->samples);
    $fixture['service']->create('pilot-split-v2');
    $file = Storage::disk('local')->allFiles('rc-research-v2/datasets/features')[0];
    $document = json_decode(Crypt::decryptString(Storage::disk('local')->get($file)), true);
    $document['examples'][0]['features']['acceleration_forward_mean'] = 999;
    Storage::disk('local')->put($file, Crypt::encryptString(json_encode($document)));
    expect(fn () => iterator_to_array($fixture['service']->stream('pilot-split-v2')))
        ->toThrow(RuntimeException::class, 'Feature values differ from the exported measurements.');
});

it('rejects incompatible channel definitions and nonlocal command execution', function () {
    $fixture = pilotFeatureFixture($this->samples);
    $manifest = $fixture['manifest'];
    $manifest['sample_columns'] = array_reverse($manifest['sample_columns']);
    $export = Mockery::mock(RcPilotDatasetExportService::class);
    $export->shouldReceive('verify')->with('pilot-split-v2')->andReturn($manifest);
    expect(fn () => (new RcPilotFeatureService($export))->create('pilot-split-v2'))
        ->toThrow(RuntimeException::class, 'Unsupported export channel order.');
    $this->artisan('rc-research:extract-features')->assertFailed();
});
