<?php

use App\Services\RcPilotDatasetExportService;
use App\Services\RcPilotFeatureService;
use App\Services\RcPilotTrainingService;
use Illuminate\Support\Facades\Storage;

it('prevents pilot training commands outside the local development environment', function () {
    $this->artisan('rc-research:train-pilot')->assertFailed();
    $this->artisan('rc-research:train-pilot', ['--verify' => true])->assertFailed();
});

it('selects a separate seven-class trainer while preserving the frozen pilot trainer', function () {
    Storage::fake('local');
    foreach (['jamjade-rc-pilot-split-v1' => RcPilotTrainingService::VERSION,
        'jamjade-rc-pilot-split-v2' => RcPilotTrainingService::VERSION_V2] as $schema => $version) {
        $features = Mockery::mock(RcPilotFeatureService::class);
        $features->shouldReceive('verify')->once()->andReturn([
            'schema' => RcPilotFeatureService::VERSION,
            'definition' => ['feature_columns' => ['measured_feature']],
            'examples' => [], 'stationary_context' => [],
        ]);
        $export = Mockery::mock(RcPilotDatasetExportService::class);
        $export->shouldReceive('verify')->once()->andReturn([
            'selection' => ['schema' => $schema],
            'recordings' => [['partition' => 'development', 'recording_id' => 'one', 'session_id' => 'session-one',
                'session_number' => 1, 'code' => 'FSS', 'surface' => 'tiles']],
        ]);
        $source = new ReflectionMethod(RcPilotTrainingService::class, 'source');
        [$input, $identity, , $script, $selectedVersion] = $source->invoke(new RcPilotTrainingService($features, $export), 'pilot-split-v3');
        expect($selectedVersion)->toBe($version)
            ->and(json_decode($input, true)['schema'])->toBe($version)
            ->and($identity['trainer_sha256'])->toBe(hash_file('sha256', base_path('ml/'.$script)));
    }
});
