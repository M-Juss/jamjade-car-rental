<?php

use App\Models\RcCollectionContext;
use App\Models\RcCollectionSession;
use App\Models\RcMountVersion;
use App\Models\RcNativeRecording;
use App\Models\RcObservationRevision;
use App\Models\User;
use App\Services\RcCollectionService;
use App\Support\RcNativeProtocol;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

function collectionOriginalFixture(): array
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
        'started_at_utc' => now()->subSecond()->startOfSecond()->addMilliseconds(100)->toISOString(), 'channels' => $channels,
        'chunks' => $chunks, 'chunk_inventory_sha256' => hash('sha256', RcNativeProtocol::canonical($chunks))];

    return [$manifest, $payloads];
}

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    config(['telematics.calibration_profile' => 'rc_demo']);
    Storage::fake('local');
    $this->admin = User::factory()->create(['is_active' => true]);
    $this->admin->assignRole('admin');
    $this->token = $this->admin->createToken('research', ['rc-research'], now()->addHour())->plainTextToken;
    [$this->manifest, $this->payloads] = collectionOriginalFixture();
    $protocol = collect(app(RcCollectionService::class)->catalog('rc-exercises-v1')['protocols'])->firstWhere('code', 'FSS');
    $hash = hash('sha256', RcNativeProtocol::canonical($protocol));
    $sessionId = (string) Str::uuid();
    $mountId = (string) Str::uuid();
    $preflightId = (string) Str::uuid();
    $clockId = (string) Str::uuid();
    $groupId = (string) Str::uuid();
    $start = (int) $this->manifest['started_elapsed_ns'] - 6000000000;
    $stats = ['count' => 251, 'rejected_count' => 0, 'mean' => [0, 0, 9.81], 'std' => [0.01, 0.01, 0.01], 'rms' => 9.81, 'rate_hz' => 50, 'max_gap_ms' => 20];
    $this->manifest['context'] = array_merge($this->manifest['context'], ['recording_group_id' => $groupId, 'recording_number' => 38, 'recording_kind' => 'maneuver_trial']);
    $this->manifest['collection_binding'] = ['contract_version' => 'rc-collection-v1', 'research_session_id' => $sessionId, 'mount_version_id' => $mountId,
        'preflight_id' => $preflightId, 'clock_context_id' => $clockId, 'catalog_version' => 'rc-exercises-v1', 'protocol_code' => 'FSS', 'protocol_sha256' => $hash];
    $json = json_encode($this->manifest, JSON_THROW_ON_ERROR);
    $this->recordId = $this->withToken($this->token)->postJson('/api/mobile/rc-research/native-recordings', ['manifest_json' => $json])->assertOk()->json('data.id');
    foreach ($this->payloads as $channel => $payload) {
        $this->postJson("/api/mobile/rc-research/native-recordings/{$this->recordId}/chunks", ['channel' => $channel, 'chunk_index' => 0, 'payload' => $payload])->assertOk();
    }
    $this->postJson("/api/mobile/rc-research/native-recordings/{$this->recordId}/finalize")->assertOk();
    $this->input = ['contract_version' => 'rc-collection-v1', 'recording_id' => $this->manifest['recording_id'], 'manifest_sha256' => hash('sha256', $json),
        'session' => ['id' => $sessionId, 'device_profile_id' => (string) Str::uuid(), 'session_number' => 2, 'recording_group_id' => $groupId,
            'opened_at' => now()->subMinute()->toISOString(), 'conditions' => ['surface' => 'Tiles', 'slope' => 'level'], 'preset_id' => 'mn82s_roof_v1', 'catalog_version' => 'rc-exercises-v1', 'operator_code' => 'OP01'],
        'mount' => ['id' => $mountId, 'research_session_id' => $sessionId, 'mount_number' => 1, 'reason' => 'initial', 'created_at' => now()->subSeconds(30)->toISOString(), 'preset_id' => 'mn82s_roof_v1', 'alignment_status' => 'pending'],
        'preflight' => ['id' => $preflightId, 'mount_version_id' => $mountId, 'clock_context_id' => $clockId,
            'consent_version' => 'rc-preflight-v1', 'consented_at' => now()->subSeconds(8)->toISOString(), 'started_at' => now()->subSeconds(7)->toISOString(),
            'start_elapsed_ns' => (string) $start, 'end_elapsed_ns' => (string) ($start + 5000000000), 'window_ms' => 5000,
            'summary_method_version' => 'rest-welford-v1', 'criteria_version' => null, 'holder_locked' => true, 'phone_top_forward' => true, 'rc_still' => true,
            'measurements' => ['accelerometer' => $stats, 'gyroscope' => array_merge($stats, ['mean' => [0, 0, 0], 'rms' => 0.001])],
            'checks' => ['sensors' => 'passed', 'timing' => 'inconclusive', 'orientation' => 'inconclusive', 'stability' => 'inconclusive'], 'result' => 'inconclusive'],
        'capture_number' => 38, 'protocol_code' => 'FSS', 'catalog_version' => 'rc-exercises-v1', 'protocol_sha256' => $hash];
    $this->contextUrl = "/api/mobile/rc-research/native-recordings/{$this->recordId}/context";
    $this->observationUrl = "/api/mobile/rc-research/native-recordings/{$this->recordId}/observations";
    $this->observation = ['id' => (string) Str::uuid(), 'base_revision' => 0, 'reported_at' => now()->toISOString(), 'completed_as_planned' => null,
        'source' => 'operator_report', 'observer_code' => null, 'flags' => ['steering_corrections'], 'actual_stop_method' => 'unknown', 'notes' => null];
});

it('syncs encrypted collection details idempotently without rewriting originals', function () {
    $this->postJson($this->contextUrl, $this->input)->assertOk()->assertJsonPath('data.display_code', 'S02-FSS-R038')->assertJsonPath('data.context_synced', true);
    $this->postJson($this->contextUrl, $this->input)->assertOk();
    expect(RcCollectionSession::count())->toBe(1)->and(RcCollectionContext::count())->toBe(1);
    $saved = RcCollectionContext::first();
    expect($saved->payload['preflight']['result'])->toBe('inconclusive')->and($saved->payload['protocol_snapshot']['code'])->toBe('FSS');
    expect(DB::table('rc_collection_contexts')->value('payload'))->not->toContain('accelerometer')->not->toContain('Tiles');
    expect(DB::table('rc_native_recordings')->value('name'))->toBe('Synthetic upload fixture');
    $this->getJson('/api/mobile/rc-research/native-recordings/status?ids[]='.$this->manifest['recording_id'])
        ->assertOk()->assertJsonPath('data.0.display_code', 'S02-FSS-R038')->assertJsonPath('data.0.annotation_version', 'rc-phase-labels-v1');
    $this->withHeader('Authorization', '')->actingAs($this->admin, 'web')
        ->getJson('/admin/rc-research/native-recordings?search=S02-FSS-R038')->assertOk()->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.display_code', 'S02-FSS-R038')->assertJsonPath('data.0.name', 'Synthetic upload fixture');

});

it('combines native recording search with owner scoped group and session filters before pagination', function () {
    $this->postJson($this->contextUrl, $this->input)->assertOk();
    $recording = RcNativeRecording::findOrFail($this->recordId);
    $session = RcCollectionSession::findOrFail($this->input['session']['id']);
    $context = RcCollectionContext::findOrFail($recording->id);
    $groupId = $session->payload['recording_group_id'];
    $otherGroupId = (string) Str::uuid();
    $otherAdmin = User::factory()->create(['is_active' => true]);
    $otherAdmin->assignRole('admin');

    $addSessionRecording = function (int $ownerId, string $group, int $number, string $name) use ($session, $context, $recording) {
        $sessionId = (string) Str::uuid();
        $mountId = (string) Str::uuid();
        $sessionPayload = [...$session->payload, 'id' => $sessionId, 'session_number' => $number, 'recording_group_id' => $group];
        $newSession = $session->replicate()->fill([
            'id' => $sessionId, 'user_id' => $ownerId, 'session_number' => $number, 'payload' => $sessionPayload,
        ]);
        $newSession->save();
        $mount = RcMountVersion::findOrFail($context->mount_id);
        $mount->replicate()->fill(['id' => $mountId, 'session_id' => $sessionId,
            'payload' => [...$mount->payload, 'id' => $mountId, 'research_session_id' => $sessionId]])->save();
        $newRecording = $recording->replicate()->fill([
            'client_recording_id' => (string) Str::uuid(), 'user_id' => $ownerId, 'name' => $name,
        ]);
        $newRecording->save();
        $preflightId = (string) Str::uuid();
        $code = sprintf('S%02d-FSS-R038', $number);
        $context->replicate()->fill([
            'recording_id' => $newRecording->id, 'mount_id' => $mountId, 'preflight_id' => $preflightId, 'display_code' => $code,
            'payload' => [...$context->payload, 'session' => $sessionPayload, 'display_code' => $code],
        ])->save();

        return $sessionId;
    };
    $sameGroupSession = $addSessionRecording($this->admin->id, $groupId, 3, 'Second tile run');
    $otherGroupSession = $addSessionRecording($this->admin->id, $otherGroupId, 4, 'Same surface, different group');
    $foreignSession = $addSessionRecording($otherAdmin->id, $groupId, 2, 'Another owner run');
    $recording->replicate()->fill(['client_recording_id' => (string) Str::uuid(), 'name' => 'Unsynced run'])->save();
    $this->withHeader('Authorization', '')->actingAs($this->admin, 'web');
    $url = '/admin/rc-research/native-recordings';

    $this->getJson($url.'?per_page=1')->assertOk()->assertJsonPath('meta.total', 4)->assertJsonCount(1, 'data')
        ->assertJsonCount(3, 'meta.filter_sessions')->assertJsonPath('meta.filter_sessions.0.id', $session->id)
        ->assertJsonPath('meta.filter_sessions.0.group_id', $groupId)
        ->assertJsonPath('meta.filter_sessions.1.id', $sameGroupSession)
        ->assertJsonPath('meta.filter_sessions.2.id', $otherGroupSession);
    $this->getJson($url."?group_id=$groupId&per_page=1")->assertOk()->assertJsonPath('meta.total', 2)->assertJsonCount(1, 'data');
    $this->getJson($url."?session_id=$sameGroupSession")->assertOk()->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.name', 'Second tile run');
    $this->getJson($url."?group_id=$groupId&session_id=$sameGroupSession&search=S03-FSS-R038")->assertOk()
        ->assertJsonPath('data.0.name', 'Second tile run');
    $this->getJson($url."?group_id=$groupId&session_id=$otherGroupSession")->assertOk()->assertJsonCount(0, 'data')
        ->assertJsonCount(3, 'meta.filter_sessions');
    $this->getJson($url."?session_id=$foreignSession")->assertOk()->assertJsonCount(0, 'data');
    $this->getJson($url.'?group_id=G1&session_id=S02')->assertUnprocessable()->assertJsonValidationErrors(['group_id', 'session_id']);
});

it('preserves independently synced observation history and detects stale writes', function () {
    $this->postJson($this->observationUrl, $this->observation)->assertOk()->assertJsonPath('data.context_synced', false)->assertJsonPath('data.observation_revision', 1);
    $this->postJson($this->observationUrl, $this->observation)->assertOk()->assertJsonPath('data.observation_revision', 1);
    $changed = array_merge($this->observation, ['notes' => 'Different retry']);
    $this->postJson($this->observationUrl, $changed)->assertConflict();
    $changed['id'] = (string) Str::uuid();
    $this->postJson($this->observationUrl, $changed)->assertConflict();
    $changed['base_revision'] = 1;
    $this->postJson($this->observationUrl, $changed)->assertOk()->assertJsonPath('data.observation_revision', 2);
    expect(RcObservationRevision::count())->toBe(2)->and(DB::table('rc_observation_revisions')->value('payload'))->not->toContain('steering_corrections');
});

it('syncs initial deviation only on a bound swerve and keeps observation retries immutable', function () {
    $report = [...$this->observation, 'initial_deviation' => 'left'];
    $this->postJson($this->contextUrl, $this->input)->assertOk();
    $this->postJson($this->observationUrl, $report)->assertUnprocessable()->assertJsonValidationErrors('initial_deviation');

    $manifest = $this->manifest;
    $manifest['recording_id'] = (string) Str::uuid();
    $manifest['context']['recording_number'] = 39;
    $protocol = collect(app(RcCollectionService::class)->catalog('rc-exercises-v1')['protocols'])->firstWhere('code', 'SW');
    $binding = &$manifest['collection_binding'];
    $binding['preflight_id'] = (string) Str::uuid();
    $binding['protocol_code'] = 'SW';
    $binding['protocol_sha256'] = hash('sha256', RcNativeProtocol::canonical($protocol));
    $json = json_encode($manifest, JSON_THROW_ON_ERROR);
    $id = $this->postJson('/api/mobile/rc-research/native-recordings', ['manifest_json' => $json])->assertOk()->json('data.id');
    $url = "/api/mobile/rc-research/native-recordings/$id";
    foreach ($this->payloads as $channel => $payload) {
        $this->postJson("$url/chunks", ['channel' => $channel, 'chunk_index' => 0, 'payload' => $payload])->assertOk();
    }
    $this->postJson("$url/finalize")->assertOk();
    $context = [...$this->input, 'recording_id' => $manifest['recording_id'], 'manifest_sha256' => hash('sha256', $json),
        'capture_number' => 39, 'protocol_code' => 'SW', 'protocol_sha256' => $binding['protocol_sha256']];
    $context['preflight']['id'] = $binding['preflight_id'];
    $this->postJson("$url/context", $context)->assertOk();
    $this->postJson("$url/observations", [...$report, 'initial_deviation' => 'forward'])
        ->assertUnprocessable()->assertJsonValidationErrors('initial_deviation');
    $this->postJson("$url/observations", $report)->assertOk()->assertJsonPath('data.observation_revision', 1);
    $this->postJson("$url/observations", $report)->assertOk()->assertJsonPath('data.observation_revision', 1);
    $this->postJson("$url/observations", [...$report, 'initial_deviation' => 'right'])->assertConflict();
    $this->withHeader('Authorization', '')->actingAs($this->admin, 'web')
        ->getJson("/admin/rc-research/native-recordings/$id")->assertOk()
        ->assertJsonPath('data.review.observation.initial_deviation', 'left');
});

it('exposes owner-bound collection review and latest observations without internal setup measurements', function () {
    $this->postJson($this->contextUrl, $this->input)->assertOk();
    $this->observation['completed_as_planned'] = false;
    $this->observation['actual_stop_method'] = 'neutral_release';
    $this->postJson($this->observationUrl, $this->observation)->assertOk();
    $this->withHeader('Authorization', '')->actingAs($this->admin, 'web')
        ->getJson('/admin/rc-research/native-recordings/'.$this->recordId)->assertOk()
        ->assertJsonPath('data.review.collection.session_number', 2)
        ->assertJsonPath('data.review.collection.preflight_result', 'inconclusive')
        ->assertJsonPath('data.review.observation.completed_as_planned', false)
        ->assertJsonPath('data.review.observation.actual_stop_method', 'neutral_release')
        ->assertJsonPath('data.review.processing.reference_status', 'missing')
        ->assertJsonPath('data.review.processing.saved_runs', 0)
        ->assertJsonMissingPath('data.review.collection.preflight.measurements')
        ->assertJsonMissingPath('data.review.observation.user_id');
    $other = User::factory()->create(['is_active' => true]);
    $other->assignRole('admin');
    $this->actingAs($other, 'web')->getJson('/admin/rc-research/native-recordings/'.$this->recordId)->assertNotFound();
});

it('keeps missing collection and observation evidence explicit in web review', function () {
    $this->withHeader('Authorization', '')->actingAs($this->admin, 'web')
        ->getJson('/admin/rc-research/native-recordings/'.$this->recordId)->assertOk()
        ->assertJsonPath('data.review.collection', null)->assertJsonPath('data.review.observation', null)
        ->assertJsonPath('data.review.processing.reference_status', 'missing');
});

it('rejects invalid or fabricated setup evidence', function (string $field, mixed $value) {
    $input = $this->input;
    data_set($input, $field, $value);
    $this->postJson($this->contextUrl, $input)->assertUnprocessable();
    expect(RcCollectionContext::count())->toBe(0)->and(RcCollectionSession::count())->toBe(0);
})->with([
    ['preflight.result', 'passed'], ['preflight.criteria_version', 'invented'], ['mount.alignment_status', 'accepted'],
    ['preflight.start_elapsed_ns', '9223372036854775808'], ['preflight.end_elapsed_ns', '5'], ['preflight.window_ms', 5001],
    ['preflight.measurements.accelerometer.mean', null], ['preflight.measurements.gyroscope.count', 0], ['preflight.measurements.gyroscope.rejected_count', 1],
    ['preflight.holder_locked', false], ['preflight.clock_context_id', 'not-a-clock'], ['protocol_sha256', str_repeat('0', 64)],
    ['capture_number', 1], ['session.conditions.surface', 'Grass'], ['mount.research_session_id', '00000000-0000-4000-8000-000000000001'],
    ['preflight.mount_version_id', '00000000-0000-4000-8000-000000000002'],
]);

it('rejects altered clock identities even with otherwise valid evidence', function () {
    $this->input['preflight']['clock_context_id'] = (string) Str::uuid();
    $this->postJson($this->contextUrl, $this->input)->assertUnprocessable();
});

it('rejects changed parent identities without overwriting an accepted context', function () {
    $this->postJson($this->contextUrl, $this->input)->assertOk();
    $this->input['session']['operator_code'] = 'OP02';
    $this->postJson($this->contextUrl, $this->input)->assertConflict();
    expect(RcCollectionSession::first()->payload['operator_code'])->toBe('OP01');
});

it('keeps owner records private and restricts tokens', function () {
    $other = User::factory()->create(['is_active' => true]);
    $other->assignRole('admin');
    $token = $other->createToken('research', ['rc-research'], now()->addHour())->plainTextToken;
    auth()->forgetGuards();
    $this->withToken($token)->postJson($this->contextUrl, $this->input)->assertNotFound();
    $this->getJson('/api/mobile/rc-research/native-recordings/status?ids[]='.$this->manifest['recording_id'])->assertOk()->assertJsonCount(0, 'data');
    $ordinary = $other->createToken('ordinary', ['*'])->plainTextToken;
    auth()->forgetGuards();
    $this->withToken($ordinary)->getJson('/api/mobile/rc-research/catalog')->assertForbidden();
});

it('requires observer provenance and rejects duplicate flags', function () {
    $this->observation['source'] = 'observed';
    $this->postJson($this->observationUrl, $this->observation)->assertUnprocessable();
    $this->observation['observer_code'] = 'OB01';
    $this->observation['flags'] = ['bump', 'bump'];
    $this->postJson($this->observationUrl, $this->observation)->assertUnprocessable();
});

it('rejects reversed fractional-second consent, session and mount times', function (string $kind) {
    $base = now()->subSeconds(10)->startOfSecond();
    if ($kind === 'consent') {
        $this->input['preflight']['consented_at'] = $base->copy()->addMilliseconds(900)->toISOString();
        $this->input['preflight']['started_at'] = $base->copy()->addMilliseconds(100)->toISOString();
    } elseif ($kind === 'mount') {
        $this->input['mount']['created_at'] = $base->copy()->addMilliseconds(900)->toISOString();
        $this->input['preflight']['consented_at'] = $base->toISOString();
        $this->input['preflight']['started_at'] = $base->copy()->addMilliseconds(100)->toISOString();
    } else {
        $this->input['session']['opened_at'] = $base->copy()->addMilliseconds(900)->toISOString();
        $this->input['mount']['created_at'] = $base->copy()->addMilliseconds(100)->toISOString();
    }
    $this->postJson($this->contextUrl, $this->input)->assertUnprocessable();
})->with(['consent', 'mount', 'session']);

it('compares preflight against the exact fractional source time in the original', function () {
    $this->input['preflight']['started_at'] = CarbonImmutable::parse($this->manifest['started_at_utc'])->startOfSecond()->addMilliseconds(900)->toISOString();
    $this->postJson($this->contextUrl, $this->input)->assertUnprocessable();
});

it('does not reuse setup evidence for another original recording', function () {
    $this->postJson($this->contextUrl, $this->input)->assertOk();
    $manifest = $this->manifest;
    $manifest['recording_id'] = (string) Str::uuid();
    $manifest['context']['recording_number'] = 39;
    $json = json_encode($manifest, JSON_THROW_ON_ERROR);
    $recordId = $this->postJson('/api/mobile/rc-research/native-recordings', ['manifest_json' => $json])->assertOk()->json('data.id');
    foreach ($this->payloads as $channel => $payload) {
        $this->postJson("/api/mobile/rc-research/native-recordings/$recordId/chunks", ['channel' => $channel, 'chunk_index' => 0, 'payload' => $payload])->assertOk();
    }
    $this->postJson("/api/mobile/rc-research/native-recordings/$recordId/finalize")->assertOk();
    $input = array_merge($this->input, ['recording_id' => $manifest['recording_id'], 'capture_number' => 39, 'manifest_sha256' => hash('sha256', $json)]);
    $this->postJson("/api/mobile/rc-research/native-recordings/$recordId/context", $input)->assertConflict();
    expect(RcCollectionContext::count())->toBe(1);
});

it('keeps v1 snapshots immutable and rejects substituting v2 instructions on an old original', function () {
    $old = app(RcCollectionService::class)->catalog('rc-exercises-v1');
    $new = app(RcCollectionService::class)->catalog('rc-exercises-v2');
    expect(collect($old['protocols'])->firstWhere('code', 'FSS')['expected_stop_method'])->toBe('brake_applied')
        ->and(collect($new['protocols'])->firstWhere('code', 'FSS')['expected_stop_method'])->toBe('neutral_release');
    $this->postJson($this->contextUrl, $this->input)->assertOk();
    $input = $this->input;
    $input['catalog_version'] = 'rc-exercises-v2';
    $input['protocol_sha256'] = hash('sha256', RcNativeProtocol::canonical(collect($new['protocols'])->firstWhere('code', 'FSS')));
    $this->postJson($this->contextUrl, $input)->assertUnprocessable();
    expect(RcCollectionContext::first()->payload['protocol_snapshot']['expected_stop_method'])->toBe('brake_applied');
});

it('syncs a v3 harsh turn in an existing session and rejects older catalog bindings', function (string $code, string $layout) {
    $this->postJson($this->contextUrl, $this->input)->assertOk();
    $manifest = $this->manifest;
    $manifest['recording_id'] = (string) Str::uuid();
    $manifest['context']['recording_number'] = 39;
    $catalog = app(RcCollectionService::class)->catalog();
    expect($catalog['catalog_version'])->toBe('rc-exercises-v3');
    $protocol = collect($catalog['protocols'])->firstWhere('code', $code);
    $hash = hash('sha256', RcNativeProtocol::canonical($protocol));
    $manifest['collection_binding'] = [...$manifest['collection_binding'], 'preflight_id' => (string) Str::uuid(),
        'catalog_version' => 'rc-exercises-v2', 'protocol_code' => $code, 'protocol_sha256' => $hash];
    $this->postJson('/api/mobile/rc-research/native-recordings', ['manifest_json' => json_encode($manifest, JSON_THROW_ON_ERROR)])
        ->assertUnprocessable();

    $manifest['collection_binding']['catalog_version'] = $catalog['catalog_version'];
    $json = json_encode($manifest, JSON_THROW_ON_ERROR);
    $id = $this->postJson('/api/mobile/rc-research/native-recordings', ['manifest_json' => $json])->assertOk()->json('data.id');
    $url = "/api/mobile/rc-research/native-recordings/$id";
    foreach ($this->payloads as $channel => $payload) {
        $this->postJson("$url/chunks", ['channel' => $channel, 'chunk_index' => 0, 'payload' => $payload])->assertOk();
    }
    $this->postJson("$url/finalize")->assertOk();
    $input = [...$this->input, 'recording_id' => $manifest['recording_id'], 'manifest_sha256' => hash('sha256', $json),
        'capture_number' => 39, 'protocol_code' => $code, 'catalog_version' => $catalog['catalog_version'], 'protocol_sha256' => $hash];
    $input['preflight']['id'] = $manifest['collection_binding']['preflight_id'];
    $this->postJson("$url/context", [...$input, 'catalog_version' => 'rc-exercises-v2'])
        ->assertUnprocessable()->assertJsonValidationErrors('protocol_code');
    $this->postJson("$url/context", $input)->assertOk()->assertJsonPath('data.display_code', "S02-$code-R039");
    $saved = RcCollectionContext::findOrFail($id)->payload;
    expect(RcCollectionSession::count())->toBe(1)
        ->and($saved['session']['catalog_version'])->toBe('rc-exercises-v1')
        ->and($saved['protocol_snapshot']['planned_assessment'])->toBe('harsh_attempt')
        ->and($saved['course_snapshot']['layout_key'])->toBe($layout);
})->with([['HLT', 'left_turn'], ['HRT', 'right_turn']]);
