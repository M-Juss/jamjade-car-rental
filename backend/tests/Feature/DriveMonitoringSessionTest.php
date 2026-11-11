<?php

use App\Models\DriveMonitoringBatch;
use App\Models\DriveMonitoringEvent;
use App\Models\DriveMonitoringSession;
use App\Models\RcNativeRecording;
use App\Models\RcProcessingRun;
use App\Models\User;
use App\Services\DriveMonitoringReferenceService;
use App\Services\RcDemoInferenceService;
use App\Services\RcProcessingRunService;
use App\Services\RcReferenceReuseService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    config(['telematics.calibration_profile' => 'rc_demo']);
    $this->owner = User::factory()->create(['is_active' => true]);
    $this->owner->assignRole('admin');
    $this->withToken($this->owner->createToken('research', ['rc-research'])->plainTextToken);
    $record = RcNativeRecording::create([
        'user_id' => $this->owner->id, 'client_recording_id' => (string) Str::uuid(),
        'name' => 'Synthetic reference', 'surface' => 'Tiles', 'state' => 'verified', 'capture_state' => 'stopped',
        'manifest_path' => 'synthetic', 'manifest_sha256' => str_repeat('a', 64),
        'expected_chunks' => 0, 'expected_bytes' => 0, 'duration_ms' => 10000, 'started_at' => now(),
    ]);
    $run = RcProcessingRun::create([
        'recording_id' => $record->id, 'version' => 'rc-sync-filter-fixed-frame-v1', 'cutoff_hz' => 5,
        'fingerprint' => str_repeat('b', 64), 'payload_path' => 'synthetic', 'payload_sha256' => str_repeat('c', 64),
    ]);
    $this->mock(RcProcessingRunService::class)->shouldReceive('result')->andReturn([]);
    $this->mock(RcReferenceReuseService::class)->shouldReceive('runProblem')->andReturn(null);
    $this->mock(DriveMonitoringReferenceService::class)->shouldReceive('forRun')->andReturn([
        'rotation_rfu' => [[1, 0, 0], [0, 1, 0], [0, 0, 1]], 'acceleration_mean' => [0, 0, 9.81], 'gyroscope_mean' => [0, 0, 0],
    ]);
    $this->input = ['client_session_id' => (string) Str::uuid(), 'reference_run_id' => $run->id,
        'consent_version' => 'drive-monitoring-v1', 'consent' => true, 'same_mount_confirmed' => true];
    $this->input += ['research_session_id' => (string) Str::uuid(), 'mount_version_id' => (string) Str::uuid()];
    $this->url = '/api/mobile/rc-research/drive-monitoring/sessions';
});

it('retries the same session and stops it idempotently', function () {
    $id = $this->postJson($this->url, $this->input)->assertOk()->json('data.id');
    $this->postJson($this->url, $this->input)->assertOk()->assertJsonPath('data.id', $id);
    $this->postJson($this->url, [...$this->input, 'client_session_id' => (string) Str::uuid()])
        ->assertUnprocessable()->assertJsonValidationErrors('client_session_id');
    $end = $this->postJson("$this->url/$id/stop")->assertOk()->assertJsonPath('data.status', 'stopped')->json('data.ended_at');
    $this->postJson("$this->url/$id/stop")->assertOk()->assertJsonPath('data.ended_at', $end);
});

it('requires explicit consent and an owned reference', function () {
    $this->postJson($this->url, [...$this->input, 'consent' => false])->assertUnprocessable();
    $other = User::factory()->create(['is_active' => true]);
    $other->assignRole('admin');
    auth()->forgetGuards();
    $this->withToken($other->createToken('research', ['rc-research'])->plainTextToken)
        ->postJson($this->url, $this->input)->assertNotFound();
});

it('lists monitoring sessions and protects detail ownership', function () {
    $id = $this->postJson($this->url, $this->input)->assertOk()->json('data.id');
    $this->withHeader('Authorization', '')->actingAs($this->owner, 'web');
    $this->getJson('/admin/rc-research/drive-monitoring/sessions')->assertOk()
        ->assertJsonPath('data.0.id', $id);
    $this->getJson("/admin/rc-research/drive-monitoring/sessions/$id")->assertOk()
        ->assertJsonPath('data.received_batches', 0)->assertJsonPath('data.recent_predictions', [])
        ->assertJsonPath('data.session.analyzed_through_ms', 0)
        ->assertJsonPath('data.event_summary', ['detected' => 0, 'needs_review' => 0, 'pending' => 0]);
    $other = User::factory()->create(['is_active' => true]);
    $other->assignRole('admin');
    $this->actingAs($other, 'web')->getJson("/admin/rc-research/drive-monitoring/sessions/$id")->assertNotFound();
});

it('replays a batch receipt without duplicate inference and rejects changed retries', function () {
    $id = $this->postJson($this->url, $this->input)->assertOk()->json('data.id');
    $payload = ['client_batch_id' => (string) Str::uuid(), 'version' => 'rc-demo-inference-v1',
        'windows' => [driveWindow(0, 400)]];
    $result = ['version' => 'rc-demo-inference-v1', 'model_sha256' => RcDemoInferenceService::MODEL_SHA256,
        'predictions' => [['id' => 'w-0-400', 'class' => 'normal_motion', 'vote' => 0.8]]];
    $this->mock(RcDemoInferenceService::class)->shouldReceive('predict')->once()->andReturn($result);
    $url = "$this->url/$id/batches";
    $this->postJson($url, $payload)->assertOk()->assertJsonPath('data.predictions.0.class', 'normal_motion');
    $this->postJson("$this->url/$id/stop")->assertOk();
    $this->postJson($url, $payload)->assertOk();
    $payload['windows'][0]['features'][0] = 1.0;
    $this->postJson($url, $payload)->assertConflict();
    $payload['client_batch_id'] = (string) Str::uuid();
    $this->postJson($url, $payload)->assertConflict();
    expect(DriveMonitoringBatch::count())->toBe(1);
});

function driveWindow(int $start, int $end): array
{
    return ['id' => "w-$start-$end", 'features' => array_fill(0, 35, 0.0), 'start_ms' => $start, 'end_ms' => $end,
        'braking_evidence' => ['peak_ms' => $start, 'vertical_peak' => 0.0, 'pitch_rate_peak' => 0.0]];
}

it('returns complete event totals independently of the bounded event preview', function () {
    $id = $this->postJson($this->url, $this->input)->assertOk()->json('data.id');
    foreach ([...array_fill(0, 51, 'confirmed'), 'review_required', 'pending', 'suppressed'] as $index => $status) {
        DriveMonitoringEvent::create(['session_id' => $id, 'target' => 'harsh_acceleration', 'status' => $status,
            'start_ms' => $index * 400, 'end_ms' => ($index + 1) * 400, 'last_ms' => ($index + 1) * 400,
            'emitted_ms' => ($index + 1) * 400, 'vote' => .8]);
    }
    DriveMonitoringSession::findOrFail($id)->update(['last_window_end_ms' => 22000]);
    $this->withHeader('Authorization', '')->actingAs($this->owner, 'web');
    $this->getJson("/admin/rc-research/drive-monitoring/sessions/$id")->assertOk()
        ->assertJsonPath('data.event_summary', ['detected' => 51, 'needs_review' => 1, 'pending' => 1])
        ->assertJsonPath('data.session.analyzed_through_ms', 22000)
        ->assertJsonCount(50, 'data.events');
});

it('groups repeated harsh windows and makes retries create no duplicate events', function () {
    $id = $this->postJson($this->url, $this->input)->assertOk()->json('data.id');
    $windows = [driveWindow(0, 400), driveWindow(200, 600)];
    $this->mock(RcDemoInferenceService::class)->shouldReceive('predict')->once()->andReturn([
        'version' => 'rc-demo-inference-v1', 'model_sha256' => RcDemoInferenceService::MODEL_SHA256,
        'predictions' => array_map(fn ($w) => ['id' => $w['id'], 'class' => 'harsh_acceleration', 'vote' => .8], $windows),
    ]);
    $payload = ['version' => 'rc-demo-inference-v1', 'client_batch_id' => (string) Str::uuid(), 'windows' => $windows];
    $this->postJson("$this->url/$id/batches", $payload)->assertOk();
    $this->postJson("$this->url/$id/batches", $payload)->assertOk();
    expect(DriveMonitoringEvent::where('session_id', $id)->count())->toBe(1)
        ->and(DriveMonitoringEvent::first()->last_ms)->toBe(600);
    $payload['client_batch_id'] = (string) Str::uuid();
    $this->postJson("$this->url/$id/batches", $payload)->assertConflict();
});

it('holds corners and suppresses an overlapping corner when the later swerve arrives', function () {
    $id = $this->postJson($this->url, $this->input)->assertOk()->json('data.id');
    $windows = [driveWindow(0, 800), driveWindow(0, 1600)];
    $this->mock(RcDemoInferenceService::class)->shouldReceive('predict')->once()->andReturn([
        'version' => 'rc-demo-inference-v1', 'model_sha256' => RcDemoInferenceService::MODEL_SHA256,
        'predictions' => [['id' => $windows[0]['id'], 'class' => 'harsh_cornering', 'vote' => .9],
            ['id' => $windows[1]['id'], 'class' => 'harsh_swerve', 'vote' => .9]],
    ]);
    $this->postJson("$this->url/$id/batches", ['version' => 'rc-demo-inference-v1', 'client_batch_id' => (string) Str::uuid(), 'windows' => $windows])->assertOk();
    expect(DriveMonitoringEvent::where('target', 'harsh_cornering')->first()->status)->toBe('suppressed')
        ->and(DriveMonitoringEvent::where('target', 'harsh_swerve')->first()->status)->toBe('confirmed');
});

it('marks a braking window with vertical and pitch evidence for review', function () {
    $id = $this->postJson($this->url, $this->input)->assertOk()->json('data.id');
    $window = driveWindow(0, 400);
    $window['braking_evidence']['vertical_peak'] = 2.1;
    $window['braking_evidence']['pitch_rate_peak'] = .9;
    $this->mock(RcDemoInferenceService::class)->shouldReceive('predict')->once()->andReturn([
        'version' => 'rc-demo-inference-v1', 'model_sha256' => RcDemoInferenceService::MODEL_SHA256,
        'predictions' => [['id' => $window['id'], 'class' => 'harsh_braking', 'vote' => .9]],
    ]);
    $this->postJson("$this->url/$id/batches", ['version' => 'rc-demo-inference-v1', 'client_batch_id' => (string) Str::uuid(), 'windows' => [$window]])->assertOk();
    expect(DriveMonitoringEvent::first()->status)->toBe('review_required');
});

it('rejects incomplete, backward and impossible timeline evidence before inference', function () {
    $id = $this->postJson($this->url, $this->input)->assertOk()->json('data.id');
    $this->mock(RcDemoInferenceService::class)->shouldNotReceive('predict');
    $bad = driveWindow(0, 420);
    $this->postJson("$this->url/$id/batches", ['version' => 'rc-demo-inference-v1', 'client_batch_id' => (string) Str::uuid(), 'windows' => [$bad]])->assertUnprocessable();
    $bad = driveWindow(0, 400);
    $bad['braking_evidence']['peak_ms'] = 400;
    $this->postJson("$this->url/$id/batches", ['version' => 'rc-demo-inference-v1', 'client_batch_id' => (string) Str::uuid(), 'windows' => [$bad]])->assertUnprocessable();
    $this->postJson("$this->url/$id/batches", ['version' => 'rc-demo-inference-v1', 'client_batch_id' => (string) Str::uuid(),
        'windows' => [driveWindow(0, 800), driveWindow(0, 400)]])->assertUnprocessable();
});

it('does not promote an unfinished corner hold on stop', function () {
    $id = $this->postJson($this->url, $this->input)->assertOk()->json('data.id');
    $window = driveWindow(0, 400);
    $this->mock(RcDemoInferenceService::class)->shouldReceive('predict')->once()->andReturn([
        'version' => 'rc-demo-inference-v1', 'model_sha256' => RcDemoInferenceService::MODEL_SHA256,
        'predictions' => [['id' => $window['id'], 'class' => 'harsh_cornering', 'vote' => .9]],
    ]);
    $this->postJson("$this->url/$id/batches", ['version' => 'rc-demo-inference-v1', 'client_batch_id' => (string) Str::uuid(), 'windows' => [$window]])->assertOk();
    expect(DriveMonitoringEvent::first()->status)->toBe('pending');
    $this->postJson("$this->url/$id/stop")->assertOk();
    expect(DriveMonitoringEvent::first()->status)->toBe('review_required');
});
