<?php

use App\Models\RcNativeRecording;
use App\Models\User;
use App\Services\RcNativeResearchService;
use App\Services\RcProcessingRunService;
use App\Services\RcReferenceReuseService;
use App\Support\RcNativeProtocol;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

function syntheticCollectionBinding(string $session, string $mount, string $code): array
{
    return ['contract_version' => 'rc-collection-v1', 'research_session_id' => $session, 'mount_version_id' => $mount,
        'preflight_id' => (string) Str::uuid(), 'clock_context_id' => (string) Str::uuid(), 'catalog_version' => 'rc-exercises-v1',
        'protocol_code' => $code, 'protocol_sha256' => str_repeat('a', 64)];
}

function reusableRecording(User $owner, string $kind, string $group, array $overrides = []): RcNativeRecording
{
    $reference = $kind === 'forward_reference';
    $origin = $reference ? 9007199254741001 : 100000000001;
    $duration = $reference ? 8000 : 2000;
    $channels = $chunks = $payloads = [];
    foreach (RcNativeProtocol::CHANNELS as $channel => [$type, $unit]) {
        $enabled = in_array($channel, ['accelerometer', 'gyroscope']);
        $channels[$channel] = ['sensor_type' => $type, 'unit' => $unit, 'availability' => $enabled ? 'registered' : 'unavailable',
            'name' => 'Synthetic '.$channel, 'vendor' => 'Synthetic', 'version' => 1, 'maximum_range' => 100,
            'resolution' => 0.001, 'min_delay_us' => 1000, 'max_delay_us' => 100000, 'wake_up' => false,
            'value_layout' => ['x', 'y', 'z'], 'sampling_period_us' => 20000, 'max_report_latency_us' => 0];
        if (! $enabled) {
            continue;
        }
        $events = [];
        for ($time = 0; $time <= $duration; $time += 20) {
            $motion = $reference ? ($time >= 5200 && $time <= 6000 ? 0.8 + 0.3 * sin($time / 100) : ($time >= 6400 && $time <= 7200 ? -0.7 : 0)) : -0.4;
            $events[] = ['sequence' => count($events), 'sensor_timestamp_ns' => (string) ($origin + $time * 1000000),
                'received_elapsed_ns' => (string) ($origin + $time * 1000000), 'accuracy' => 3,
                'values' => $channel === 'accelerometer' ? [0, $motion, 9.81] : [0.001, -0.002, $reference ? 0.003 : 0.013]];
        }
        $payload = implode("\n", array_map(fn ($e) => json_encode($e, JSON_THROW_ON_ERROR), $events))."\n";
        $payloads[$channel] = $payload;
        $chunks[] = ['channel' => $channel, 'chunk_index' => 0, 'sealed' => true, 'event_count' => count($events),
            'logical_bytes' => strlen($payload), 'sha256' => hash('sha256', $payload), 'first_sequence' => 0,
            'last_sequence' => count($events) - 1, 'first_sensor_timestamp_ns' => $events[0]['sensor_timestamp_ns'],
            'last_sensor_timestamp_ns' => $events[array_key_last($events)]['sensor_timestamp_ns']];
    }
    $manifest = ['protocol_version' => 2, 'source' => 'android_sensor_manager_v2', 'recording_id' => (string) Str::uuid(),
        'collection_session_id' => (string) Str::uuid(), 'coordinate_frame' => 'android_device_natural', 'natural_orientation' => 'portrait',
        'state' => 'stopped', 'integrity' => 'sealed', 'consent_version' => 3,
        'context' => ['name' => 'Synthetic '.$kind, 'surface' => 'Tiles', 'slope' => 'level', 'recording_kind' => $kind,
            'recording_group_id' => $group, 'preset_id' => 'mn82s_roof_v1', 'rc_model' => 'MN-82S Supertourer',
            'mount_method' => 'Adjustable screw', 'mount_location' => 'upper_roof', 'mount_orientation' => 'tilted',
            'screen_facing' => 'up', 'phone_top_toward_rc_front' => true, 'consent' => true],
        'device' => ['manufacturer' => 'Synthetic', 'model' => 'Synthetic phone', 'android_api' => 30, 'native_adapter_version' => '1.2.0'],
        'started_elapsed_ns' => (string) $origin, 'ended_elapsed_ns' => (string) ($origin + $duration * 1000000), 'duration_ms' => $duration,
        'started_at_utc' => ($reference ? now()->subMinutes(2) : now()->subSeconds(30))->toISOString(), 'channels' => $channels,
        'chunks' => $chunks, 'chunk_inventory_sha256' => hash('sha256', RcNativeProtocol::canonical($chunks))];
    foreach ($overrides as $path => $value) {
        data_set($manifest, $path, $value);
    }
    $service = app(RcNativeResearchService::class);
    $record = $service->begin($owner, json_encode($manifest, JSON_THROW_ON_ERROR));
    foreach ($payloads as $channel => $payload) {
        $service->chunk($record, $channel, 0, $payload);
    }

    return $service->finalize($record);
}

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    config(['telematics.calibration_profile' => 'rc_demo']);
    Storage::fake('local');
    $this->admin = User::factory()->create(['is_active' => true]);
    $this->admin->assignRole('admin');
    $this->actingAs($this->admin, 'web');
    $this->group = (string) Str::uuid();
    $this->source = reusableRecording($this->admin, 'forward_reference', $this->group);
    $this->fit = ['start_ms' => 0, 'end_ms' => 8000, 'cutoff_hz' => 5, 'confirmed' => true,
        'ranges' => ['rest' => [0, 5000], 'starting' => [5200, 6000], 'stopping' => [6400, 7200]]];
    $this->referenceRun = app(RcProcessingRunService::class)->create($this->source, $this->fit);
    $this->target = reusableRecording($this->admin, 'maneuver_trial', $this->group);
    $this->url = '/admin/rc-research/native-recordings/'.$this->target->id;
    $this->input = ['start_ms' => 0, 'end_ms' => 2000, 'cutoff_hz' => 5, 'confirmed' => true,
        'reference_run_id' => $this->referenceRun->id, 'same_mount_confirmed' => true];
});

it('reuses only server-recomputed axes and offsets while retaining the trial clock and originals', function () {
    $before = Storage::disk('local')->allFiles();
    $hashes = array_map(fn ($p) => hash('sha256', Storage::disk('local')->get($p)), $before);
    $detail = $this->postJson($this->url.'/processing-runs', [...$this->input, 'rotation_rfu' => [[0, 0, 0]]])->assertOk()
        ->assertJsonPath('data.run.version', 'rc-reused-fixed-frame-v1')
        ->assertJsonPath('data.run.reference_run_id', $this->referenceRun->id)
        ->assertJsonPath('data.result.reference_origin.recording_id', $this->source->id)
        ->assertJsonPath('data.result.reference_origin.ranges.rest', [0, 5000])
        ->assertJsonPath('data.result.config.same_mount_confirmed', true)
        ->assertJsonMissingPath('data.result.config.ranges')
        ->assertJsonPath('data.result.rows.0.sensor_timestamp_ns', '100000000001')
        ->assertJsonPath('data.result.counts.rows', 101)->json('data');
    expect($detail['result']['signals']['acceleration']['after'][0]['x'])->toBeNull();
    expect($detail['result']['signals']['acceleration']['after'][30]['x'])->toEqualWithDelta(-0.4, 1e-10);
    expect($detail['result']['signals']['gyroscope']['after'][30]['z'])->toEqualWithDelta(0.01, 1e-10);
    expect($detail['result']['reference'])->toBe(app(RcProcessingRunService::class)->result($this->referenceRun)['reference']);
    expect(array_map(fn ($p) => hash('sha256', Storage::disk('local')->get($p)), $before))->toBe($hashes);
    $this->postJson($this->url.'/processing-runs', $this->input)->assertOk()->assertJsonPath('data.run.id', $detail['run']['id']);
    $this->getJson($this->url.'/processing-runs/'.$detail['run']['id'])->assertOk()->assertJsonPath('data.result.reference_origin.run_fingerprint', $this->referenceRun->fingerprint);
    $this->postJson($this->url.'/processing-runs', [...$this->input, 'cutoff_hz' => 8])->assertOk();
    $this->assertDatabaseCount('rc_processing_runs', 3);
    $this->getJson($this->url.'/reference-runs')->assertOk()->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonCount(1, 'data')->assertJsonPath('data.0.compatible', true)->assertJsonMissingPath('data.0.reference');
});

it('rejects mismatched setup, conditions, device, sensors and later references', function (string $path, mixed $value) {
    $target = reusableRecording($this->admin, 'maneuver_trial', $this->group, [$path => $value]);
    $url = '/admin/rc-research/native-recordings/'.$target->id;
    $choices = $this->getJson($url.'/reference-runs')->assertOk();
    if ($path === 'started_at_utc') {
        $choices->assertJsonCount(0, 'data');
    } else {
        $choices->assertJsonPath('data.0.compatible', false);
    }
    $this->postJson($url.'/processing-runs', $this->input)->assertUnprocessable()->assertJsonValidationErrors('reference_run_id');
    $this->assertDatabaseCount('rc_processing_runs', 1);
})->with([
    ['context.recording_group_id', '22222222-2222-4222-8222-222222222222'], ['context.mount_method', 'Other mount'],
    ['context.slope', 'uphill'], ['context.surface', 'Concrete'], ['context.screen_facing', 'down'],
    ['device.model', 'Other phone'], ['device.model', null], ['device.native_adapter_version', '2.0.0'],
    ['channels.accelerometer.vendor', 'Other sensor'], ['channels.gyroscope.resolution', 0.01],
    ['natural_orientation', 'landscape'], ['started_at_utc', '2000-01-01T00:00:00Z'],
]);

it('requires explicit reference review and unchanged-mount confirmation without target phase labels', function (string $field, mixed $value) {
    $input = $this->input;
    data_set($input, $field, $value);
    $this->postJson($this->url.'/processing-runs', $input)->assertUnprocessable();
    $this->assertDatabaseCount('rc_processing_runs', 1);
})->with([['confirmed', false], ['same_mount_confirmed', false], ['same_mount_confirmed', null],
    ['reference_run_id', null], ['reference_run_id', 'invalid'], ['ranges', ['rest' => [0, 5000], 'starting' => [5200, 6000], 'stopping' => [6400, 7200]]]]);

it('does not disclose another owner reference or allow chained references', function () {
    $other = User::factory()->create(['is_active' => true]);
    $other->assignRole('admin');
    $source = reusableRecording($other, 'forward_reference', $this->group);
    $run = app(RcProcessingRunService::class)->create($source, $this->fit);
    $this->postJson($this->url.'/processing-runs', [...$this->input, 'reference_run_id' => $run->id])->assertNotFound();
    $this->getJson($this->url.'/reference-runs')->assertOk()->assertJsonCount(1, 'data');
    $reused = $this->postJson($this->url.'/processing-runs', $this->input)->assertOk()->json('data.run.id');
    $next = reusableRecording($this->admin, 'maneuver_trial', $this->group);
    $this->postJson('/admin/rc-research/native-recordings/'.$next->id.'/processing-runs', [...$this->input, 'reference_run_id' => $reused])->assertUnprocessable();
    $this->actingAs($other, 'web');
    $this->getJson($this->url.'/reference-runs')->assertNotFound();
    $this->postJson($this->url.'/processing-runs', $this->input)->assertNotFound();
});

it('rejects short pilot references, wrong recording purposes and corrupted source originals', function () {
    $short = app(RcProcessingRunService::class)->create($this->source, [...$this->fit, 'ranges' => [...$this->fit['ranges'], 'rest' => [0, 1000]]]);
    $this->postJson($this->url.'/processing-runs', [...$this->input, 'reference_run_id' => $short->id])->assertUnprocessable();
    $this->postJson('/admin/rc-research/native-recordings/'.$this->source->id.'/processing-runs', $this->input)->assertUnprocessable();
    $this->postJson($this->url.'/processing-runs', $this->fit)->assertUnprocessable();
    Storage::disk('local')->put($this->source->chunks()->first()->payload_path, Crypt::encryptString('changed'));
    $this->postJson($this->url.'/processing-runs', $this->input)->assertStatus(503);
    $this->assertDatabaseCount('rc_processing_runs', 2);
});

it('keeps reference history bounded and preserves reference foreign keys', function () {
    for ($i = 1; $i <= 10; $i++) {
        app(RcProcessingRunService::class)->create($this->source, [...$this->fit, 'ranges' => [...$this->fit['ranges'], 'rest' => [0, 5000 + $i * 10]]]);
    }
    $this->getJson($this->url.'/reference-runs')->assertOk()->assertJsonCount(10, 'data')->assertJsonPath('meta.total', 11);
    $this->getJson($this->url.'/reference-runs?page=2')->assertOk()->assertJsonCount(1, 'data');
    $this->getJson($this->url.'/reference-runs?per_page=11')->assertUnprocessable();
    $this->postJson($this->url.'/processing-runs', $this->input)->assertOk();
    expect(fn () => $this->referenceRun->delete())->toThrow(QueryException::class);
});

it('requires the same declared session and mount for reference reuse', function (string $change) {
    $session = (string) Str::uuid();
    $mount = (string) Str::uuid();
    $source = reusableRecording($this->admin, 'forward_reference', $this->group, ['collection_binding' => syntheticCollectionBinding($session, $mount, 'FR')]);
    $binding = syntheticCollectionBinding($change === 'session' ? (string) Str::uuid() : $session, $change === 'mount' ? (string) Str::uuid() : $mount, 'FSS');
    $target = reusableRecording($this->admin, 'maneuver_trial', $this->group, $change === 'legacy' ? [] : ['collection_binding' => $binding]);
    $research = app(RcNativeResearchService::class);
    $problem = app(RcReferenceReuseService::class)->compatibility($target, $research->manifest($target), $source, $research->manifest($source));
    expect($problem)->toBe($change === 'same' ? null : 'Capture a forward reference for this research session and mount.');
})->with(['session', 'mount', 'legacy', 'same']);
