<?php

use App\Models\RcNativeRecording;
use App\Models\User;
use App\Services\ModelExplorerService;
use App\Services\RcPilotDatasetExportService;
use App\Services\RcResearchAccessService;
use App\Services\RcRuntimeForestService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->app->detectEnvironment(fn () => 'local');
    $this->seed(RoleAndPermissionSeeder::class);
    config(['telematics.calibration_profile' => 'rc_demo']);
    $this->admin = User::factory()->create(['is_active' => true]);
    $this->admin->assignRole('admin');
});

function modelExplorerRecording(User $user): RcNativeRecording
{
    return RcNativeRecording::create([
        'user_id' => $user->id, 'client_recording_id' => (string) Str::uuid(), 'name' => 'Research recording',
        'surface' => 'track', 'state' => 'verified', 'capture_state' => 'stopped', 'manifest_path' => 'private/manifest',
        'manifest_sha256' => str_repeat('a', 64), 'expected_chunks' => 1, 'expected_bytes' => 100,
        'duration_ms' => 1000, 'started_at' => now(),
    ]);
}

it('requires an Admin session and the RC research profile for the private read endpoint', function () {
    $this->getJson('/admin/rc-research/model-explorer')->assertUnauthorized();
    $staff = User::factory()->create(['is_active' => true]);
    $staff->assignRole('staff');
    $this->actingAs($staff, 'web')->getJson('/admin/rc-research/model-explorer')->assertForbidden();

    config(['telematics.calibration_profile' => 'standard']);
    $this->actingAs($this->admin, 'web')->getJson('/admin/rc-research/model-explorer')->assertForbidden();
});

it('returns owner-scoped examples with private no-store caching', function () {
    $owned = modelExplorerRecording($this->admin);
    $other = modelExplorerRecording(User::factory()->create());
    $rows = [
        ['recording_id' => $owned->id, 'role' => 'supervised_target', 'target' => 'braking', 'start_ms' => 20, 'end_ms' => 100, 'samples' => []],
        ['recording_id' => $other->id, 'role' => 'supervised_target', 'target' => 'turn', 'start_ms' => 20, 'end_ms' => 100, 'samples' => []],
    ];
    $this->mock(RcPilotDatasetExportService::class)->shouldReceive('streamFrozenDevelopment')->once()->andReturn((function () use ($rows) {
        yield from $rows;
    })());
    $this->actingAs($this->admin, 'web')->getJson('/admin/rc-research/model-explorer')
        ->assertOk()->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonCount(1, 'data')->assertJsonPath('data.0.target', 'braking');
});

it('returns a safe unavailable response when the frozen development package fails', function () {
    $this->mock(RcPilotDatasetExportService::class)->shouldReceive('streamFrozenDevelopment')->once()->andThrow(new RuntimeException('private file details'));
    $this->actingAs($this->admin, 'web')->getJson('/admin/rc-research/model-explorer')
        ->assertStatus(503)->assertDontSee('private file details');
});

it('blocks the read endpoint outside local environments', function () {
    $this->app->detectEnvironment(fn () => 'production');
    $this->mock(RcResearchAccessService::class)->shouldReceive('enabled')->once()->andReturn(true);
    $this->actingAs($this->admin, 'web')->getJson('/admin/rc-research/model-explorer')->assertStatus(503);
});

it('opens the frozen example endpoint for an explicitly enabled hosted demo', function () {
    $this->app->detectEnvironment(fn () => 'production');
    config(['telematics.hosted_rc_demo' => true]);
    $this->mock(ModelExplorerService::class)->shouldReceive('index')->once()->withArgs(fn (User $user) => $user->is($this->admin))->andReturn([]);
    $this->actingAs($this->admin, 'web')->getJson('/admin/rc-research/model-explorer')->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private');
});

it('does not expose an example id for a recording owned by another account', function () {
    $owned = modelExplorerRecording($this->admin);
    $otherUser = User::factory()->create();
    $other = modelExplorerRecording($otherUser);
    $rows = [
        ['recording_id' => $owned->id, 'role' => 'supervised_target', 'target' => 'braking', 'start_ms' => 20, 'end_ms' => 100, 'samples' => []],
        ['recording_id' => $other->id, 'role' => 'supervised_target', 'target' => 'turn', 'start_ms' => 20, 'end_ms' => 100, 'samples' => []],
    ];
    $this->mock(RcPilotDatasetExportService::class)->shouldReceive('streamFrozenDevelopment')->twice()->andReturnUsing(fn () => (function () use ($rows) {
        yield from $rows;
    })());
    $service = app(ModelExplorerService::class);
    expect($service->index($this->admin))->toHaveCount(1)
        ->and(fn () => $service->show($this->admin, 1))->toThrow(Exception::class);
});

it('returns owner-bound sample provenance and computed features for one real prepared example', function () {
    $owned = modelExplorerRecording($this->admin);
    $other = modelExplorerRecording(User::factory()->create());
    $samples = [[0, 3, 0, 0, 0, 0, 0], [20, 5, 0, 0, 0, 0, 0]];
    $rows = [
        ['recording_id' => $owned->id, 'role' => 'supervised_target', 'target' => 'braking', 'start_ms' => 0, 'end_ms' => 40, 'samples' => $samples],
        ['recording_id' => $other->id, 'role' => 'supervised_target', 'target' => 'turn', 'start_ms' => 0, 'end_ms' => 40, 'samples' => $samples],
    ];
    $this->mock(RcPilotDatasetExportService::class)->shouldReceive('streamFrozenDevelopment')->once()->andReturnUsing(fn () => (function () use ($rows) {
        yield from $rows;
    })());
    $this->mock(RcRuntimeForestService::class)->shouldReceive('explain')->once()->withArgs(fn ($features) => count($features) === 35)
        ->andReturn(['prediction' => 'braking', 'scores' => ['braking' => 0.8, 'normal_motion' => 0.2], 'trees' => [], 'model_sha256' => str_repeat('b', 64)]);

    $this->actingAs($this->admin, 'web')->getJson('/admin/rc-research/model-explorer/0')
        ->assertOk()->assertJsonPath('data.partition', 'development')
        ->assertJsonPath('data.snapshot_sha256', '7cc3b2efe0f3284af6bea681c879db0497890bdca92a69e112b6d5845dff7498')
        ->assertJsonCount(7, 'data.sample_columns')->assertJsonCount(35, 'data.feature_names')
        ->assertJsonPath('data.features.0', 4)->assertJsonPath('data.features.30', 0)
        ->assertJsonPath('data.yaw_details.peak_absolute_yaw', 0)
        ->assertJsonPath('data.decision.prediction', 'braking');
});
