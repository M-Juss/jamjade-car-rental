<?php

use App\Models\RcNativeRecording;
use App\Models\RcProcessingRun;
use App\Models\User;
use App\Services\DriveMonitoringReferenceService;
use App\Services\RcMotionProcessing;
use App\Services\RcNativeResearchService;
use App\Services\RcProcessingRunService;
use App\Services\RcReferenceReuseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;

uses(RefreshDatabase::class);

it('recomputes source-bound references and rejects another mount or changed measurements', function () {
    $owner = User::factory()->create();
    $record = RcNativeRecording::create(['user_id' => $owner->id, 'client_recording_id' => (string) Str::uuid(),
        'name' => 'Synthetic', 'surface' => 'Tiles', 'state' => 'verified', 'capture_state' => 'stopped',
        'manifest_path' => 'synthetic', 'manifest_sha256' => str_repeat('a', 64), 'expected_chunks' => 0,
        'expected_bytes' => 0, 'duration_ms' => 10000, 'started_at' => now()]);
    $run = new RcProcessingRun(['recording_id' => $record->id, 'cutoff_hz' => 5]);
    $reference = ['rotation_rfu' => [[1, 0, 0], [0, 1, 0], [0, 0, 1]], 'acceleration_mean' => [0, 0, 9.81], 'gyroscope_mean' => [0, 0, 0]];
    $manifest = ['context' => ['recording_kind' => 'forward_reference'], 'collection_binding' => ['research_session_id' => 'session', 'mount_version_id' => 'mount'],
        'started_elapsed_ns' => '1000000000', 'chunk_inventory_sha256' => str_repeat('b', 64)];
    $payload = ['source' => ['recording_id' => $record->id, 'manifest_sha256' => $record->manifest_sha256, 'chunk_inventory_sha256' => str_repeat('b', 64)],
        'config' => ['start_ms' => 0, 'end_ms' => 10000], 'reference' => $reference];
    $this->mock(RcNativeResearchService::class, function ($mock) use ($manifest) {
        $mock->shouldReceive('manifest')->andReturn($manifest);
        $mock->shouldReceive('window')->andReturn(['events' => []]);
    });
    $this->mock(RcProcessingRunService::class)->shouldReceive('result')->andReturn($payload);
    $this->mock(RcReferenceReuseService::class)->shouldReceive('runProblem')->andReturn(null);
    $motion = $this->mock(RcMotionProcessing::class);
    $motion->shouldReceive('calculate')->once()->andReturn(['reference' => $reference]);
    $service = app(DriveMonitoringReferenceService::class);
    expect($service->forRun($owner, $run, 'session', 'mount'))->toBe($reference);
    expect(fn () => $service->forRun($owner, $run, 'session', 'other'))->toThrow(HttpException::class);
    $motion->shouldReceive('calculate')->once()->andReturn(['reference' => [...$reference, 'acceleration_mean' => [1, 2, 3]]]);
    expect(fn () => $service->forRun($owner, $run, 'session', 'mount'))->toThrow(HttpException::class);
});
