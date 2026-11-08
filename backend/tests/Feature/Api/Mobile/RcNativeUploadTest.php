<?php

use App\Models\RcNativeRecording;
use App\Models\User;
use App\Support\RcNativeProtocol;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

function nativeUploadFixture(): array
{
    $origin = 9007199254741001; // Synthetic monotonic time beyond JS safe integer range.
    $chunks = $payloads = $channels = [];
    foreach (RcNativeProtocol::CHANNELS as $channel => [$type, $unit]) {
        $channels[$channel] = ['sensor_type' => $type, 'unit' => $unit, 'availability' => in_array($channel, ['accelerometer', 'gyroscope']) ? 'registered' : 'unavailable'];
        if (! in_array($channel, ['accelerometer', 'gyroscope'])) {
            continue;
        }
        $events = [];
        for ($i = 0; $i < 4; $i++) {
            $events[] = ['sequence' => $i, 'sensor_timestamp_ns' => (string) ($origin + $i * 20000000),
                'received_elapsed_ns' => (string) ($origin + $i * 20000000 + 1000000), 'accuracy' => 3,
                'values' => [$i * 0.1, 0, $channel === 'accelerometer' ? 9.8 : 0.05]];
        }
        $payload = implode("\n", array_map(fn ($e) => json_encode($e, JSON_THROW_ON_ERROR), $events))."\n";
        $chunks[] = ['channel' => $channel, 'chunk_index' => 0, 'sealed' => true, 'event_count' => 4,
            'logical_bytes' => strlen($payload), 'sha256' => hash('sha256', $payload), 'first_sequence' => 0, 'last_sequence' => 3,
            'first_sensor_timestamp_ns' => $events[0]['sensor_timestamp_ns'], 'last_sensor_timestamp_ns' => $events[3]['sensor_timestamp_ns']];
        $payloads[$channel] = $payload;
    }
    $manifest = ['protocol_version' => 2, 'source' => 'android_sensor_manager_v2', 'recording_id' => (string) Str::uuid(),
        'collection_session_id' => (string) Str::uuid(), 'coordinate_frame' => 'android_device_natural',
        'state' => 'stopped', 'integrity' => 'sealed', 'consent_version' => 3,
        'context' => ['name' => 'Synthetic upload fixture', 'surface' => 'Tiles', 'slope' => 'level', 'recording_kind' => 'stationary_reference', 'mount_method' => 'Adjustable screw', 'consent' => true],
        'started_elapsed_ns' => (string) $origin, 'ended_elapsed_ns' => (string) ($origin + 80000000), 'duration_ms' => 80,
        'started_at_utc' => now()->subSecond()->toISOString(), 'channels' => $channels,
        'chunks' => $chunks, 'chunk_inventory_sha256' => hash('sha256', RcNativeProtocol::canonical($chunks))];

    return [$manifest, $payloads];
}

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    config(['telematics.calibration_profile' => 'rc_demo']);
    Storage::fake('local');
    $this->admin = User::factory()->create(['is_active' => true]);
    $this->admin->assignRole('admin');
    $this->token = $this->admin->createToken('research', ['rc-research'], now()->addHours(1))->plainTextToken;
    [$this->manifest, $this->payloads] = nativeUploadFixture();
    $this->manifestJson = json_encode($this->manifest, JSON_THROW_ON_ERROR);
});

it('stores exact originals encrypted, retries idempotently and verifies the complete inventory', function () {
    $id = $this->withToken($this->token)->postJson('/api/mobile/rc-research/native-recordings', ['manifest_json' => $this->manifestJson])
        ->assertOk()->assertJsonPath('data.state', 'incomplete')->json('data.id');
    $this->withToken($this->token)->postJson('/api/mobile/rc-research/native-recordings', ['manifest_json' => $this->manifestJson])
        ->assertOk()->assertJsonPath('data.id', $id);
    $this->postJson("/api/mobile/rc-research/native-recordings/$id/finalize")->assertConflict();
    foreach ($this->payloads as $channel => $payload) {
        foreach ([1, 2] as $attempt) {
            $this->postJson("/api/mobile/rc-research/native-recordings/$id/chunks", ['channel' => $channel, 'chunk_index' => 0, 'payload' => $payload])->assertOk();
        }
    }
    $this->postJson("/api/mobile/rc-research/native-recordings/$id/finalize")->assertOk()
        ->assertJsonPath('data.state', 'verified')->assertJsonPath('data.received_chunks', 2)
        ->assertJsonPath('data.summary.accelerometer.event_count', 4)->assertJsonPath('data.summary.gyroscope.rate_hz', 50)
        ->assertJsonPath('data.annotation_state', 'unlabeled')->assertJsonMissingPath('data.manifest_path');
    $record = RcNativeRecording::findOrFail($id);
    expect(Crypt::decryptString(Storage::disk('local')->get($record->manifest_path)))->toBe($this->manifestJson);
    foreach ($record->chunks as $chunk) {
        $encrypted = Storage::disk('local')->get($chunk->payload_path);
        expect($encrypted)->not->toContain('sensor_timestamp_ns');
        expect(Crypt::decryptString($encrypted))->toBe($this->payloads[$chunk->channel]);
    }
    $this->assertDatabaseCount('rc_native_recordings', 1);
    $this->assertDatabaseCount('rc_native_recording_chunks', 2);
    $this->assertDatabaseCount('rc_research_trials', 0);
});

it('allows local research to upload past the standard recording limit', function () {
    $url = '/api/mobile/rc-research/native-recordings';
    $id = $this->withToken($this->token)->postJson($url, ['manifest_json' => $this->manifestJson])
        ->assertOk()->json('data.id');
    $existing = RcNativeRecording::findOrFail($id)->getAttributes();
    $records = [];
    for ($i = 0; $i < 99; $i++) {
        $records[] = array_replace($existing, ['id' => (string) Str::uuid(), 'client_recording_id' => (string) Str::uuid()]);
    }
    RcNativeRecording::insert($records);

    $newManifest = array_replace($this->manifest, ['recording_id' => (string) Str::uuid()]);
    $payload = ['manifest_json' => json_encode($newManifest, JSON_THROW_ON_ERROR)];
    $this->postJson($url, $payload)->assertConflict()->assertJsonPath('message', 'Research storage limit reached. Contact the administrator.');

    $this->app->instance('env', 'local');
    $this->postJson($url, $payload)->assertOk()->assertJsonPath('data.state', 'incomplete');
    $this->assertDatabaseCount('rc_native_recordings', 101);

    $records = [];
    for ($i = 0; $i < 899; $i++) {
        $records[] = array_replace($existing, ['id' => (string) Str::uuid(), 'client_recording_id' => (string) Str::uuid()]);
    }
    RcNativeRecording::insert($records);
    $this->postJson($url, $payload)->assertOk();
    $newManifest['recording_id'] = (string) Str::uuid();
    $this->postJson($url, ['manifest_json' => json_encode($newManifest, JSON_THROW_ON_ERROR)])->assertConflict();
    $this->assertDatabaseCount('rc_native_recordings', 1000);
});

it('enforces the local payload budget while preserving retries', function () {
    $this->app->instance('env', 'local');
    $url = '/api/mobile/rc-research/native-recordings';
    $payload = ['manifest_json' => $this->manifestJson];
    $id = $this->withToken($this->token)->postJson($url, $payload)->assertOk()->json('data.id');
    RcNativeRecording::whereKey($id)->update(['expected_bytes' => 2147483648]);
    $this->postJson($url, $payload)->assertOk()->assertJsonPath('data.id', $id);
    $manifest = array_replace($this->manifest, ['recording_id' => (string) Str::uuid()]);
    $this->postJson($url, ['manifest_json' => json_encode($manifest, JSON_THROW_ON_ERROR)])->assertConflict();
    $this->assertDatabaseCount('rc_native_recordings', 1);
});

it('rejects changed content under an existing recording or chunk identity', function () {
    $id = $this->withToken($this->token)->postJson('/api/mobile/rc-research/native-recordings', ['manifest_json' => $this->manifestJson])->json('data.id');
    $changed = $this->manifest;
    $changed['context']['name'] = 'Changed';
    $this->postJson('/api/mobile/rc-research/native-recordings', ['manifest_json' => json_encode($changed)])->assertConflict();
    $this->postJson("/api/mobile/rc-research/native-recordings/$id/chunks", ['channel' => 'accelerometer', 'chunk_index' => 0,
        'payload' => str_replace('9.8', '9.7', $this->payloads['accelerometer'])])->assertConflict();
});

it('rejects invalid versions, timestamps, channel units and inventory hashes', function (string $kind) {
    $m = $this->manifest;
    match ($kind) {
        'version' => $m['protocol_version'] = 1,
        'number_timestamp' => $m['started_elapsed_ns'] = 9007199254741001,
        'overflow' => $m['started_elapsed_ns'] = '9223372036854775808',
        'unit' => $m['channels']['gyroscope']['unit'] = 'deg/s',
        'hash' => $m['chunk_inventory_sha256'] = str_repeat('0', 64),
        'consent' => $m['context']['consent'] = false,
    };
    $this->withToken($this->token)->postJson('/api/mobile/rc-research/native-recordings', ['manifest_json' => json_encode($m)])->assertUnprocessable();
    $this->assertDatabaseCount('rc_native_recordings', 0);
})->with(['version', 'number_timestamp', 'overflow', 'unit', 'hash', 'consent']);

it('keeps owner and authentication boundaries on upload and inspection', function () {
    $id = $this->withToken($this->token)->postJson('/api/mobile/rc-research/native-recordings', ['manifest_json' => $this->manifestJson])->json('data.id');
    $other = User::factory()->create(['is_active' => true]);
    $other->assignRole('admin');
    $this->app['auth']->forgetGuards();
    $this->withToken($other->createToken('research', ['rc-research'], now()->addHour())->plainTextToken)
        ->postJson("/api/mobile/rc-research/native-recordings/$id/finalize")->assertNotFound();
    $this->withHeader('Authorization', '')->actingAs($other, 'web')->getJson("/admin/rc-research/native-recordings/$id")->assertNotFound();
    $this->withHeader('Authorization', '')->actingAs($this->admin, 'web')
        ->postJson('/api/mobile/rc-research/native-recordings', ['manifest_json' => $this->manifestJson])->assertForbidden();
});

it('reads bounded original windows preserving nanoseconds and radian units, and rejects corrupted files', function () {
    $this->withToken($this->token);
    $id = $this->postJson('/api/mobile/rc-research/native-recordings', ['manifest_json' => $this->manifestJson])->json('data.id');
    foreach ($this->payloads as $channel => $payload) {
        $this->postJson("/api/mobile/rc-research/native-recordings/$id/chunks", ['channel' => $channel, 'chunk_index' => 0, 'payload' => $payload])->assertOk();
    }
    $this->postJson("/api/mobile/rc-research/native-recordings/$id/finalize")->assertOk();
    $this->withHeader('Authorization', '')->actingAs($this->admin, 'web');
    $this->getJson('/admin/rc-research/native-recordings')->assertOk()->assertJsonCount(1, 'data')->assertJsonMissingPath('data.0.manifest');
    $this->getJson("/admin/rc-research/native-recordings/$id")->assertOk()->assertJsonPath('data.manifest.channels.gyroscope.unit', 'rad/s');
    $url = "/admin/rc-research/native-recordings/$id/window?channel=gyroscope&start_ms=20&end_ms=40";
    $this->getJson($url)->assertOk()->assertJsonCount(2, 'data.events')
        ->assertJsonPath('data.events.0.sensor_timestamp_ns', '9007199274741001')->assertJsonPath('data.events.0.elapsed_ms', 20);
    $this->getJson("/admin/rc-research/native-recordings/$id/window?channel=gyroscope&start_ms=0&end_ms=30001")->assertUnprocessable();
    $chunk = RcNativeRecording::find($id)->chunks()->where('channel', 'gyroscope')->first();
    Storage::disk('local')->put($chunk->payload_path, Crypt::encryptString('changed'));
    $this->getJson($url)->assertStatus(503)->assertJsonMissingPath('data.events');
});

it('rejects malformed events even when their declared hashes match', function (string $kind) {
    $events = array_map(fn ($line) => json_decode($line, true), explode("\n", trim($this->payloads['accelerometer'])));
    match ($kind) {
        'numeric_ns' => $events[1]['sensor_timestamp_ns'] = 9007199274741001,
        'wrong_values' => $events[1]['values'] = [1, 2],
        'sequence' => $events[1]['sequence'] = 0,
    };
    $payload = implode("\n", array_map(fn ($e) => json_encode($e), $events))."\n";
    $m = $this->manifest;
    $m['chunks'][0]['sha256'] = hash('sha256', $payload);
    $m['chunks'][0]['logical_bytes'] = strlen($payload);
    $m['chunk_inventory_sha256'] = hash('sha256', RcNativeProtocol::canonical($m['chunks']));
    $id = $this->withToken($this->token)->postJson('/api/mobile/rc-research/native-recordings', ['manifest_json' => json_encode($m)])->assertOk()->json('data.id');
    $this->postJson("/api/mobile/rc-research/native-recordings/$id/chunks", ['channel' => 'accelerometer', 'chunk_index' => 0, 'payload' => $payload])->assertUnprocessable();
    $this->assertDatabaseCount('rc_native_recording_chunks', 0);
})->with(['numeric_ns', 'wrong_values', 'sequence']);

it('retains finite backwards sensor timestamps and reports anomalies instead of silently sorting', function () {
    $events = array_map(fn ($line) => json_decode($line, true), explode("\n", trim($this->payloads['accelerometer'])));
    $events[2]['sensor_timestamp_ns'] = $events[0]['sensor_timestamp_ns'];
    $payload = implode("\n", array_map(fn ($e) => json_encode($e), $events))."\n";
    $m = $this->manifest;
    $m['chunks'][0]['sha256'] = hash('sha256', $payload);
    $m['chunks'][0]['logical_bytes'] = strlen($payload);
    $m['chunk_inventory_sha256'] = hash('sha256', RcNativeProtocol::canonical($m['chunks']));
    $this->payloads['accelerometer'] = $payload;
    $id = $this->withToken($this->token)->postJson('/api/mobile/rc-research/native-recordings', ['manifest_json' => json_encode($m)])->assertOk()->json('data.id');
    foreach ($this->payloads as $channel => $content) {
        $this->postJson("/api/mobile/rc-research/native-recordings/$id/chunks", ['channel' => $channel, 'chunk_index' => 0, 'payload' => $content])->assertOk();
    }
    $this->postJson("/api/mobile/rc-research/native-recordings/$id/finalize")->assertOk()
        ->assertJsonPath('data.summary.accelerometer.backwards_timestamps', 1)
        ->assertJsonPath('data.summary.accelerometer.event_count', 4);
});

it('denies uploads outside active Admin research bearer sessions', function (string $kind) {
    if ($kind === 'staff') {
        $this->admin->syncRoles('staff');
    }
    if ($kind === 'inactive') {
        $this->admin->update(['is_active' => false]);
    }
    if ($kind === 'disabled') {
        config(['telematics.calibration_profile' => 'standard']);
    }
    $token = $this->admin->createToken('test', [$kind === 'scope' ? 'mobile' : 'rc-research'], $kind === 'expired' ? now()->subSecond() : now()->addHour());
    $this->withToken($token->plainTextToken)->postJson('/api/mobile/rc-research/native-recordings', ['manifest_json' => $this->manifestJson])
        ->assertStatus($kind === 'expired' ? 401 : 403);
})->with(['staff', 'inactive', 'disabled', 'scope', 'expired']);
