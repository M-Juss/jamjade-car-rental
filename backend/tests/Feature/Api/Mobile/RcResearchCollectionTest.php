<?php

use App\Models\RcResearchTrial;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

function researchSessionPayload(): array
{
    return ['name' => 'Controlled trial', 'phone_model' => 'Test phone', 'rc_model' => 'Test RC',
        'surface' => 'Smooth concrete', 'slope' => 'level', 'mount_orientation' => 'flat', 'mount_method' => 'Fixed holder',
        'battery_condition' => 'full', 'platform' => 'android', 'app_version' => '1.0.0', 'consent' => true];
}

function researchTrialPayload(): array
{
    $samples = [];
    for ($i = 0; $i <= 500; $i++) {
        $samples[] = ['elapsed_ms' => $i * 20, 'acceleration_timestamp_s' => 100 + $i / 50,
            'gravity_timestamp_s' => 100 + $i / 50, 'rotation_timestamp_s' => 100 + $i / 50,
            'linear_x' => 1, 'linear_y' => 0, 'linear_z' => 0, 'including_gravity_x' => 1,
            'including_gravity_y' => 0, 'including_gravity_z' => 9.80665,
            'rotation_x' => 0, 'rotation_y' => 0, 'rotation_z' => 2, 'orientation' => 0];
    }

    return ['client_trial_id' => 'trial-one', 'protocol_version' => 1, 'intended_movement' => 'acceleration',
        'intended_intensity' => 'normal', 'observed_movement' => 'acceleration', 'observed_intensity' => 'normal',
        'label_status' => 'confirmed', 'quality' => 'usable', 'event_start_ms' => 1000, 'event_end_ms' => 9000,
        'started_at' => now()->utc()->subSeconds(10)->format('Y-m-d\TH:i:s.v\Z'),
        'ended_at' => now()->utc()->format('Y-m-d\TH:i:s.v\Z'), 'samples_json' => json_encode($samples)];
}

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    config(['telematics.calibration_profile' => 'rc_demo']);
    Storage::fake('local');
    $this->admin = User::factory()->create(['is_active' => true]);
    $this->admin->assignRole('admin');
    $this->token = $this->admin->createToken('research', ['rc-research'])->plainTextToken;
    $this->withToken($this->token);
});

it('creates a consented fixed-load session and saves encrypted samples with a server summary', function () {
    $session = $this->postJson('/api/mobile/rc-research/sessions', researchSessionPayload())
        ->assertCreated()->assertJsonPath('data.added_load_g', 0)->assertJsonPath('data.protocol.recording_mode', 'manual')
        ->assertJsonMissingPath('data.user_id')->json('data.id');
    $trial = $this->postJson("/api/mobile/rc-research/sessions/$session/trials", researchTrialPayload())
        ->assertCreated()->assertJsonPath('data.summary.sample_count', 501)
        ->assertJsonPath('data.summary.eligible_for_training', true)
        ->assertJsonMissingPath('data.samples_path')->assertJsonMissingPath('data.samples')->json('data.id');
    $record = RcResearchTrial::findOrFail($trial);
    $encrypted = Storage::disk('local')->get($record->samples_path);
    expect($encrypted)->not->toContain('linear_x');
    expect(json_decode(Crypt::decryptString($encrypted), true)['samples'])->toHaveCount(501);
    expect($record->summary['linear_rms'])->toEqual(1)
        ->and($record->summary['rotation_peak'])->toEqual(2);
    $this->getJson('/api/mobile/rc-research/trials')->assertOk()->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.session.name', 'Controlled trial');
    $this->assertDatabaseCount('telematics_setup_sessions', 0);
    $this->assertDatabaseCount('telematics_trips', 0);
});

it('validates consent, enums, bounds and server-owned session fields', function () {
    $this->postJson('/api/mobile/rc-research/sessions', [...researchSessionPayload(), 'consent' => false,
        'name' => str_repeat('x', 101), 'mount_orientation' => 'unknown', 'added_load_g' => 50, 'user_id' => 1])
        ->assertUnprocessable()->assertJsonValidationErrors(['consent', 'name', 'mount_orientation', 'added_load_g', 'user_id']);
    $this->assertDatabaseCount('rc_research_sessions', 0);
});

it('accepts manual recordings longer than ten seconds including samples after forty seconds', function () {
    $this->freezeTime();
    $session = $this->postJson('/api/mobile/rc-research/sessions', researchSessionPayload())->json('data.id');
    $payload = researchTrialPayload();
    $samples = json_decode($payload['samples_json'], true);
    foreach ($samples as &$sample) {
        $sample['elapsed_ms'] *= 5;
        foreach (['acceleration_timestamp_s', 'gravity_timestamp_s', 'rotation_timestamp_s'] as $field) {
            $sample[$field] = 100 + ($sample[$field] - 100) * 5;
        }
    }
    unset($sample);
    $payload['samples_json'] = json_encode($samples);
    $payload['started_at'] = now()->utc()->subSeconds(50)->format('Y-m-d\\TH:i:s.v\\Z');
    $payload['event_end_ms'] = 49000;
    $this->postJson("/api/mobile/rc-research/sessions/$session/trials", $payload)->assertCreated()
        ->assertJsonPath('data.summary.duration_ms', 50000)
        ->assertJsonPath('data.summary.eligible_for_training', true);
});

it('does not save a trial when private storage fails', function () {
    $session = $this->postJson('/api/mobile/rc-research/sessions', researchSessionPayload())->json('data.id');
    $disk = Mockery::mock(FilesystemAdapter::class);
    $disk->shouldReceive('put')->once()->andReturn(false);
    Storage::shouldReceive('disk')->with('local')->andReturn($disk);
    $this->postJson("/api/mobile/rc-research/sessions/$session/trials", researchTrialPayload())->assertStatus(503);
    $this->assertDatabaseCount('rc_research_trials', 0);
});

it('retains saved recordings until explicit deletion and isolates read and delete access', function () {
    $session = $this->postJson('/api/mobile/rc-research/sessions', researchSessionPayload())->json('data.id');
    $id = $this->postJson("/api/mobile/rc-research/sessions/$session/trials", researchTrialPayload())->json('data.id');
    $path = RcResearchTrial::findOrFail($id)->samples_path;
    $this->travel(365)->days();
    $this->getJson('/api/mobile/rc-research/trials')->assertOk()->assertJsonPath('data.0.id', $id);
    Storage::disk('local')->assertExists($path);
    $other = User::factory()->create(['is_active' => true]);
    $other->assignRole('admin');
    app('auth')->forgetGuards();
    $this->withToken($other->createToken('research', ['rc-research'])->plainTextToken)
        ->deleteJson("/api/mobile/rc-research/trials/$id")->assertNotFound();
    $this->getJson('/api/mobile/rc-research/trials')->assertJsonCount(0, 'data');
    Storage::disk('local')->assertExists($path);
});

it('prevents duplicate trial uploads and rejects changed retries', function () {
    $session = $this->postJson('/api/mobile/rc-research/sessions', researchSessionPayload())->json('data.id');
    $payload = researchTrialPayload();
    $id = $this->postJson("/api/mobile/rc-research/sessions/$session/trials", $payload)->assertCreated()->json('data.id');
    $this->postJson("/api/mobile/rc-research/sessions/$session/trials", $payload)->assertCreated()->assertJsonPath('data.id', $id);
    $this->postJson("/api/mobile/rc-research/sessions/$session/trials", [...$payload, 'notes' => 'Changed'])->assertConflict();
    $this->assertDatabaseCount('rc_research_trials', 1);
    expect(Storage::disk('local')->allFiles())->toHaveCount(1);
});

it('rejects invalid labels, event intervals and injected summary fields', function () {
    $session = $this->postJson('/api/mobile/rc-research/sessions', researchSessionPayload())->json('data.id');
    $this->postJson("/api/mobile/rc-research/sessions/$session/trials", [...researchTrialPayload(),
        'observed_movement' => 'stationary', 'observed_intensity' => 'harsh', 'event_end_ms' => 1000,
        'summary' => ['sample_count' => 501]])->assertUnprocessable()
        ->assertJsonValidationErrors(['observed_intensity', 'event_end_ms', 'summary']);
    $this->assertDatabaseCount('rc_research_trials', 0);
});

it('rejects invalid sample contents and timing without retaining a file', function (string $kind) {
    $session = $this->postJson('/api/mobile/rc-research/sessions', researchSessionPayload())->json('data.id');
    $payload = researchTrialPayload();
    $samples = json_decode($payload['samples_json'], true);
    if ($kind === 'extra') {
        $samples[0]['latitude'] = 14;
    }
    if ($kind === 'numeric-string') {
        $samples[0]['linear_x'] = '1';
    }
    if ($kind === 'order') {
        $samples[4]['acceleration_timestamp_s'] = 99;
    }
    if ($kind === 'sync') {
        $samples[4]['rotation_timestamp_s'] += 1;
    }
    $payload['samples_json'] = $kind === 'json' ? '{' : json_encode($samples);
    $this->postJson("/api/mobile/rc-research/sessions/$session/trials", $payload)
        ->assertUnprocessable()->assertJsonValidationErrors('samples_json');
    $this->assertDatabaseCount('rc_research_trials', 0);
    expect(Storage::disk('local')->allFiles())->toBeEmpty();
})->with(['extra', 'numeric-string', 'order', 'sync', 'json']);

it('keeps gap-affected recordings but prevents them from qualifying for training', function () {
    $session = $this->postJson('/api/mobile/rc-research/sessions', researchSessionPayload())->json('data.id');
    $payload = researchTrialPayload();
    $samples = json_decode($payload['samples_json'], true);
    $payload['samples_json'] = json_encode([...array_slice($samples, 0, 100), ...array_slice($samples, 150)]);
    $this->postJson("/api/mobile/rc-research/sessions/$session/trials", $payload)->assertCreated()
        ->assertJsonPath('data.summary.eligible_for_training', false)
        ->assertJsonPath('data.summary.quality_flags.0', 'sample_gaps');
});

it('isolates other Admin sessions and ordinary mobile accounts', function () {
    $session = $this->postJson('/api/mobile/rc-research/sessions', researchSessionPayload())->json('data.id');
    $other = User::factory()->create(['is_active' => true]);
    $other->assignRole('admin');
    app('auth')->forgetGuards();
    $this->withToken($other->createToken('research', ['rc-research'])->plainTextToken)
        ->postJson("/api/mobile/rc-research/sessions/$session/trials", researchTrialPayload())->assertNotFound();
    $this->getJson('/api/mobile/rc-research/trials')->assertJsonCount(0, 'data');
    app('auth')->forgetGuards();
    $this->withToken($other->createToken('ordinary', ['mobile'])->plainTextToken)
        ->postJson('/api/mobile/rc-research/sessions', researchSessionPayload())->assertForbidden();
});

it('deletes samples and keeps a tombstone that blocks upload resurrection', function () {
    $session = $this->postJson('/api/mobile/rc-research/sessions', researchSessionPayload())->json('data.id');
    $payload = researchTrialPayload();
    $id = $this->postJson("/api/mobile/rc-research/sessions/$session/trials", $payload)->json('data.id');
    $this->deleteJson("/api/mobile/rc-research/trials/$id")->assertOk();
    $this->deleteJson("/api/mobile/rc-research/trials/$id")->assertOk();
    $this->getJson('/api/mobile/rc-research/trials')->assertJsonCount(0, 'data');
    $this->postJson("/api/mobile/rc-research/sessions/$session/trials", $payload)->assertConflict();
    expect(Storage::disk('local')->allFiles())->toBeEmpty();
});

it('keeps a failed deletion visible and permits a complete retry', function () {
    $session = $this->postJson('/api/mobile/rc-research/sessions', researchSessionPayload())->json('data.id');
    $id = $this->postJson("/api/mobile/rc-research/sessions/$session/trials", researchTrialPayload())->json('data.id');
    $path = RcResearchTrial::findOrFail($id)->samples_path;
    $realDisk = Storage::disk('local');
    $disk = Mockery::mock(FilesystemAdapter::class);
    $disk->shouldReceive('delete')->once()->with($path)->andReturn(false);
    $disk->shouldReceive('delete')->once()->with($path)->andReturnUsing(fn () => $realDisk->delete($path));
    Storage::shouldReceive('disk')->with('local')->andReturn($disk);
    $this->deleteJson("/api/mobile/rc-research/trials/$id")->assertStatus(503);
    $this->getJson('/api/mobile/rc-research/trials')->assertJsonPath('data.0.id', $id);
    $realDisk->assertExists($path);
    $this->deleteJson("/api/mobile/rc-research/trials/$id")->assertOk();
    $this->getJson('/api/mobile/rc-research/trials')->assertJsonCount(0, 'data');
    $realDisk->assertMissing($path);
});
