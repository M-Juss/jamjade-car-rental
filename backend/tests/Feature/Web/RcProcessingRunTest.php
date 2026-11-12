<?php

use App\Models\RcProcessingRun;
use App\Models\User;
use App\Services\RcNativeResearchService;
use App\Support\RcNativeProtocol;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    config(['telematics.calibration_profile' => 'rc_demo']);
    Storage::fake('local');
    $this->admin = User::factory()->create(['is_active' => true]);
    $this->admin->assignRole('admin');
    $this->actingAs($this->admin, 'web');
    $origin = 9007199254741001;
    $payloads = $chunks = $channels = [];
    foreach (RcNativeProtocol::CHANNELS as $channel => [$type, $unit]) {
        $enabled = in_array($channel, ['accelerometer', 'gyroscope']);
        $channels[$channel] = ['sensor_type' => $type, 'unit' => $unit, 'availability' => $enabled ? 'registered' : 'unavailable'];
        if (! $enabled) {
            continue;
        }
        $events = [];
        for ($i = 0; $i <= 200; $i++) {
            $time = $i * 20;
            $forward = $time >= 1000 && $time <= 1800 ? 0.6 + 0.3 * sin($time / 100) : ($time >= 2800 && $time <= 3600 ? -0.7 : 0);
            $events[] = ['sequence' => $i, 'sensor_timestamp_ns' => (string) ($origin + $time * 1000000),
                'received_elapsed_ns' => (string) ($origin + $time * 1000000), 'accuracy' => 3,
                'values' => $channel === 'accelerometer' ? [0, $forward, 9.81] : [0.001, -0.002, 0.003]];
        }
        $payload = implode("\n", array_map(fn ($e) => json_encode($e, JSON_THROW_ON_ERROR), $events))."\n";
        $payloads[$channel] = $payload;
        $chunks[] = ['channel' => $channel, 'chunk_index' => 0, 'sealed' => true, 'event_count' => count($events),
            'logical_bytes' => strlen($payload), 'sha256' => hash('sha256', $payload), 'first_sequence' => 0, 'last_sequence' => 200,
            'first_sensor_timestamp_ns' => $events[0]['sensor_timestamp_ns'], 'last_sensor_timestamp_ns' => $events[200]['sensor_timestamp_ns']];
    }
    $manifest = ['protocol_version' => 2, 'source' => 'android_sensor_manager_v2', 'recording_id' => (string) Str::uuid(),
        'collection_session_id' => (string) Str::uuid(), 'coordinate_frame' => 'android_device_natural',
        'state' => 'stopped', 'integrity' => 'sealed', 'consent_version' => 3,
        'context' => ['name' => 'Synthetic processing fixture', 'surface' => 'Tiles', 'slope' => 'level', 'recording_kind' => 'forward_reference', 'mount_method' => 'Adjustable screw', 'consent' => true],
        'started_elapsed_ns' => (string) $origin, 'ended_elapsed_ns' => (string) ($origin + 4000000000), 'duration_ms' => 4000,
        'started_at_utc' => now()->subMinute()->toISOString(), 'channels' => $channels, 'chunks' => $chunks,
        'chunk_inventory_sha256' => hash('sha256', RcNativeProtocol::canonical($chunks))];
    $service = app(RcNativeResearchService::class);
    $this->record = $service->begin($this->admin, json_encode($manifest, JSON_THROW_ON_ERROR));
    foreach ($payloads as $channel => $payload) {
        $service->chunk($this->record, $channel, 0, $payload);
    }
    $this->record = $service->finalize($this->record);
    $this->url = '/admin/rc-research/native-recordings/'.$this->record->id.'/processing-runs';
    $this->input = ['start_ms' => 0, 'end_ms' => 4000, 'cutoff_hz' => 5, 'confirmed' => true,
        'ranges' => ['rest' => [0, 800], 'starting' => [1000, 1800], 'stopping' => [2800, 3600]]];
});

it('recomputes and encrypts immutable reproducible runs without changing originals', function () {
    $before = Storage::disk('local')->allFiles();
    $hashes = array_map(fn ($file) => hash('sha256', Storage::disk('local')->get($file)), $before);
    $response = $this->postJson($this->url, [...$this->input, 'rotation_rfu' => [[0, 0, 0]]])->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('data.result.counts.rows', 201)
        ->assertJsonPath('data.result.reference.rotation_rfu.1.1', 1)
        ->assertJsonPath('data.result.rows.0.sensor_timestamp_ns', '9007199254741001')
        ->assertJsonMissingPath('data.run.payload_path');
    $id = $response->json('data.run.id');
    $first = $response->json('data');
    expect(abs($first['result']['reference']['rotation_rfu'][1][0]))->toBeLessThan(1e-12);
    $this->postJson($this->url, $this->input)->assertOk()->assertJsonPath('data.run.id', $id);
    $this->getJson($this->url.'/'.$id)->assertOk()->assertExactJson(['success' => true, 'message' => 'Processing result fetched.', 'data' => $first]);
    $run = RcProcessingRun::findOrFail($id);
    $encrypted = Storage::disk('local')->get($run->payload_path);
    expect($encrypted)->not->toContain('sensor_timestamp_ns');
    expect(json_decode(Crypt::decryptString($encrypted), true)['source']['manifest_sha256'])->toBe($this->record->manifest_sha256);
    expect(array_map(fn ($file) => hash('sha256', Storage::disk('local')->get($file)), $before))->toBe($hashes);
    $this->postJson($this->url, [...$this->input, 'cutoff_hz' => 8])->assertOk()->assertJsonPath('data.run.cutoff_hz', 8);
    $this->assertDatabaseCount('rc_processing_runs', 2);
    $this->getJson($this->url)->assertOk()->assertJsonCount(2, 'data')->assertJsonMissingPath('data.0.result');
});

it('validates cutoff, confirmation, interval shape, order, duration and recording bounds', function ($field, $value) {
    $input = $this->input;
    data_set($input, $field, $value);
    $this->postJson($this->url, $input)->assertUnprocessable();
    $this->assertDatabaseCount('rc_processing_runs', 0);
})->with([
    ['cutoff_hz', 4], ['confirmed', false], ['ranges.rest', [0, 200]], ['ranges.starting', [700, 1800]],
    ['ranges.stopping', ['a' => 2800, 'b' => 3600]], ['ranges.stopping', [2800, 3600, 3700]],
    ['ranges.stopping', [3600, 2800]], ['end_ms', 30001], ['end_ms', 4100], ['ranges.other', [0, 500]],
]);

it('refuses incomplete recordings and corrupted original or derived files', function () {
    $this->record->update(['state' => 'incomplete']);
    $this->postJson($this->url, $this->input)->assertConflict();
    $this->record->update(['state' => 'verified']);
    $id = $this->postJson($this->url, $this->input)->assertOk()->json('data.run.id');
    $run = RcProcessingRun::find($id);
    Storage::disk('local')->put($run->payload_path, Crypt::encryptString('{}'));
    $this->getJson($this->url.'/'.$id)->assertStatus(503)->assertJsonMissingPath('data.result');
    $this->postJson($this->url, $this->input)->assertStatus(503);
    Storage::disk('local')->put($this->record->chunks()->first()->payload_path, 'corrupted');
    $this->postJson($this->url, [...$this->input, 'cutoff_hz' => 8])->assertStatus(503);
    $this->assertDatabaseCount('rc_processing_runs', 1);
});

it('enforces ownership, active Admin, enabled research and nested run ownership', function () {
    $id = $this->postJson($this->url, $this->input)->assertOk()->json('data.run.id');
    $other = User::factory()->create(['is_active' => true]);
    $other->assignRole('admin');
    $this->actingAs($other, 'web');
    $this->getJson($this->url)->assertOk();
    $this->getJson($this->url.'/'.$id)->assertOk();
    $this->postJson($this->url, $this->input)->assertOk();
    $this->actingAs($this->admin, 'web');
    $another = $this->record->replicate();
    $another->client_recording_id = (string) Str::uuid();
    $another->save();
    $this->getJson('/admin/rc-research/native-recordings/'.$another->id.'/processing-runs/'.$id)->assertNotFound();
    config(['telematics.calibration_profile' => 'standard']);
    $this->postJson($this->url, $this->input)->assertForbidden();
    config(['telematics.calibration_profile' => 'rc_demo']);
    $this->admin->syncRoles('staff');
    $this->getJson($this->url)->assertForbidden();
    $this->postJson($this->url, $this->input)->assertForbidden();
    $this->admin->syncRoles('admin');
    $this->admin->update(['is_active' => false]);
    $this->getJson($this->url)->assertForbidden();
});

it('does not leave a result file when database persistence fails', function () {
    $before = Storage::disk('local')->allFiles();
    RcProcessingRun::creating(fn () => throw new RuntimeException('Synthetic persistence failure'));
    try {
        $this->postJson($this->url, $this->input)->assertStatus(500);
    } finally {
        RcProcessingRun::flushEventListeners();
    }
    expect(Storage::disk('local')->allFiles())->toBe($before);
    $this->assertDatabaseCount('rc_processing_runs', 0);
});
