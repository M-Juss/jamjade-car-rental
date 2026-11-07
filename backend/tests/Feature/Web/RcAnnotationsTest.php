<?php

use App\Models\RcAnnotationRevision;
use App\Models\User;
use App\Services\RcAnnotationService;
use App\Services\RcNativeResearchService;
use App\Support\RcNativeProtocol;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
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
    $channels = [];
    foreach (RcNativeProtocol::CHANNELS as $channel => [$type, $unit]) {
        $channels[$channel] = ['sensor_type' => $type, 'unit' => $unit, 'availability' => 'unavailable'];
    }
    $manifest = ['protocol_version' => 2, 'source' => 'android_sensor_manager_v2', 'recording_id' => (string) Str::uuid(),
        'collection_session_id' => (string) Str::uuid(), 'coordinate_frame' => 'android_device_natural',
        'state' => 'stopped', 'integrity' => 'sealed', 'consent_version' => 3,
        'context' => ['name' => 'Synthetic annotation fixture', 'surface' => 'Tiles', 'slope' => 'level',
            'recording_kind' => 'maneuver_trial', 'mount_method' => 'Adjustable screw', 'consent' => true],
        'started_elapsed_ns' => '9007199254741001', 'ended_elapsed_ns' => '9007203254741001', 'duration_ms' => 4000,
        'started_at_utc' => now()->subMinute()->toISOString(), 'channels' => $channels, 'chunks' => [],
        'chunk_inventory_sha256' => hash('sha256', RcNativeProtocol::canonical([]))];
    $service = app(RcNativeResearchService::class);
    $this->record = $service->begin($this->admin, json_encode($manifest, JSON_THROW_ON_ERROR));
    $this->record = $service->finalize($this->record);
    $this->base = '/admin/rc-research/native-recordings/'.$this->record->id;
    $this->url = $this->base.'/annotations';
    $this->interval = ['start_ms' => 0, 'end_ms' => 1000, 'movement' => 'stationary', 'direction' => 'not_applicable',
        'severity' => 'not_applicable', 'certainty' => 'reviewed', 'source' => 'operator_report', 'notes' => 'Synthetic note'];
    $this->input = ['base_revision' => 0, 'intervals' => [$this->interval]];
});

it('stores separate encrypted labels with immutable revisions and no training approval', function () {
    $before = Storage::disk('local')->allFiles();
    $hashes = array_map(fn ($p) => hash('sha256', Storage::disk('local')->get($p)), $before);
    $this->getJson($this->url)->assertOk()->assertJsonPath('data', null);
    $first = $this->postJson($this->url, $this->input)->assertOk()->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonPath('data.revision', 1)->assertJsonPath('data.state', 'reviewed')
        ->assertJsonPath('data.intervals.0.notes', 'Synthetic note')->assertJsonMissingPath('data.reviewer_id')
        ->assertJsonMissingPath('data.eligible_for_training')->json('data');
    expect(DB::table('rc_annotation_revisions')->value('intervals'))->not->toContain('Synthetic note');
    $this->postJson($this->url, $this->input)->assertOk()->assertJsonPath('data.id', $first['id']);
    $this->getJson($this->base)->assertOk()->assertJsonPath('data.recording.annotation_state', 'reviewed');
    $this->getJson('/admin/rc-research/native-recordings')->assertOk()->assertJsonPath('data.0.annotation_state', 'reviewed');
    $this->postJson($this->url, ['base_revision' => 1, 'intervals' => []])->assertOk()->assertJsonPath('data.revision', 2)->assertJsonPath('data.state', 'unlabeled');
    $this->getJson($this->url.'/'.$first['id'])->assertOk()->assertJsonPath('data.intervals.0.notes', 'Synthetic note');
    $this->getJson($this->url.'/history')->assertOk()->assertJsonCount(2, 'data')->assertJsonMissingPath('data.0.intervals');
    $this->getJson($this->base)->assertOk()->assertJsonPath('data.recording.annotation_state', 'unlabeled');
    expect(array_map(fn ($p) => hash('sha256', Storage::disk('local')->get($p)), $before))->toBe($hashes);
    $this->assertDatabaseCount('rc_processing_runs', 0);
});

it('rejects stale drafts and keeps the winning snapshot', function () {
    $this->postJson($this->url, $this->input)->assertOk();
    $changed = [...$this->input, 'intervals' => [[...$this->interval, 'notes' => 'Other reviewer draft']]];
    $this->postJson($this->url, $changed)->assertConflict();
    $this->assertDatabaseCount('rc_annotation_revisions', 1);
    $this->getJson($this->url)->assertOk()->assertJsonPath('data.intervals.0.notes', 'Synthetic note');
});

it('keeps swerve deviation separate from travel direction and preserves legacy revisions', function () {
    $swerve = [...$this->interval, 'movement' => 'swerving', 'direction' => 'forward', 'severity' => 'unknown', 'certainty' => 'uncertain'];
    $legacy = $this->postJson($this->url, ['base_revision' => 0, 'intervals' => [$swerve]])
        ->assertOk()->assertJsonMissingPath('data.intervals.0.initial_deviation')->json('data.id');
    foreach (['forward', null] as $invalid) {
        $this->postJson($this->url, ['base_revision' => 1, 'intervals' => [[...$swerve, 'initial_deviation' => $invalid]]])
            ->assertUnprocessable()->assertJsonValidationErrors('intervals.0.initial_deviation');
    }
    $this->postJson($this->url, ['base_revision' => 1, 'intervals' => [[...$this->interval, 'initial_deviation' => 'left']]])
        ->assertUnprocessable()->assertJsonValidationErrors('intervals.0.initial_deviation');
    $this->postJson($this->url, ['base_revision' => 1, 'intervals' => [[...$swerve, 'initial_deviation' => 'right']]])
        ->assertOk()->assertJsonPath('data.intervals.0.direction', 'forward')->assertJsonPath('data.intervals.0.initial_deviation', 'right');
    $this->getJson($this->url)->assertOk()->assertJsonPath('data.intervals.0.initial_deviation', 'right');
    $this->getJson($this->url.'/'.$legacy)->assertOk()->assertJsonMissingPath('data.intervals.0.initial_deviation');
});

it('preserves half-open adjacent intervals, uncertainty and unlabeled gaps', function () {
    $this->postJson($this->url, ['base_revision' => 0, 'intervals' => [$this->interval,
        [...$this->interval, 'start_ms' => 1000, 'end_ms' => 2000, 'movement' => 'acceleration', 'direction' => 'forward', 'severity' => 'normal', 'certainty' => 'uncertain', 'source' => 'signal_review']]])
        ->assertOk()->assertJsonPath('data.state', 'uncertain')->assertJsonCount(2, 'data.intervals');
});

it('validates bounds, overlap, fields, provenance and semantic combinations', function (string $field, mixed $value) {
    $input = $this->input;
    data_set($input, $field, $value);
    $this->postJson($this->url, $input)->assertUnprocessable();
    $this->assertDatabaseCount('rc_annotation_revisions', 0);
})->with([
    ['base_revision', -1], ['base_revision', 1001], ['base_revision', 1.5], ['intervals', null],
    ['intervals', ['key' => []]], ['intervals', array_fill(0, 101, [])],
    ['intervals.0.start_ms', -1], ['intervals.0.end_ms', 0], ['intervals.0.end_ms', 4001],
    ['intervals.0.end_ms', 'not-a-number'], ['intervals.0.extra', 'unexpected'],
    ['intervals.0.movement', 'invented'], ['intervals.0.direction', 'forward'],
    ['intervals.0.severity', 'harsh'], ['intervals.0.source', 'signal_review'],
    ['intervals.0.notes', str_repeat('x', 1001)], ['intervals.0.certainty', 'automatic'],
]);

it('refuses overlaps and invalid nonstationary assessments', function () {
    $this->postJson($this->url, ['base_revision' => 0, 'intervals' => [$this->interval,
        [...$this->interval, 'start_ms' => 999, 'end_ms' => 2000]]])->assertUnprocessable()->assertJsonValidationErrors('intervals.1.start_ms');
    $this->postJson($this->url, ['base_revision' => 0, 'intervals' => [[...$this->interval, 'movement' => 'driving']]])->assertUnprocessable();
    $this->postJson($this->url, ['base_revision' => 0, 'intervals' => [[...$this->interval, 'movement' => 'driving', 'direction' => 'unknown', 'severity' => 'normal']]])->assertUnprocessable();
});

it('enforces owner, role, enabled profile and recording integrity boundaries', function () {
    $this->record->update(['state' => 'incomplete']);
    $this->postJson($this->url, $this->input)->assertConflict();
    $this->record->update(['state' => 'verified']);
    $other = User::factory()->create(['is_active' => true]);
    $other->assignRole('admin');
    $this->actingAs($other, 'web');
    $this->getJson($this->url)->assertNotFound();
    $this->getJson($this->url.'/history')->assertNotFound();
    $this->postJson($this->url, $this->input)->assertNotFound();
    $this->actingAs($this->admin, 'web');
    config(['telematics.calibration_profile' => 'standard']);
    $this->getJson($this->url)->assertForbidden();
    $this->postJson($this->url, $this->input)->assertForbidden();
    config(['telematics.calibration_profile' => 'rc_demo']);
    $staff = User::factory()->create(['is_active' => true]);
    $staff->assignRole('staff');
    $this->actingAs($staff, 'web');
    $this->postJson($this->url, $this->input)->assertForbidden();
    $this->assertDatabaseCount('rc_annotation_revisions', 0);
});

it('limits history pages and binds historical revisions to their recording', function () {
    for ($i = 0; $i < 11; $i++) {
        app(RcAnnotationService::class)->save($this->record, $this->admin->id, ['base_revision' => $i,
            'intervals' => [[...$this->interval, 'notes' => "Synthetic revision $i"]]]);
    }
    $this->getJson($this->url.'/history')->assertOk()->assertJsonCount(10, 'data')->assertJsonPath('meta.total', 11);
    $this->getJson($this->url.'/history?page=2')->assertOk()->assertJsonCount(1, 'data');
    $this->getJson($this->url.'/history?per_page=11')->assertUnprocessable();
    $second = $this->record->replicate();
    $second->client_recording_id = (string) Str::uuid();
    $second->save();
    $foreign = RcAnnotationRevision::first()->replicate();
    $foreign->recording_id = $second->id;
    $foreign->save();
    // A genuine revision from another recording cannot be read through this one.
    $this->getJson($this->url.'/'.$foreign->id)->assertNotFound();
    $this->getJson('/admin/rc-research/native-recordings/'.$second->id.'/annotations/'.$foreign->id)->assertOk();
});

it('keeps annotation reads and writes behind authentication', function () {
    auth('web')->logout();
    $this->getJson($this->url)->assertUnauthorized();
    $this->getJson($this->url.'/history')->assertUnauthorized();
    $this->postJson($this->url, $this->input)->assertUnauthorized();
});

it('accepts a full bounded revision with maximum-length encrypted notes', function () {
    $intervals = [];
    for ($i = 0; $i < 100; $i++) {
        $intervals[] = [...$this->interval, 'start_ms' => $i * 40, 'end_ms' => ($i + 1) * 40,
            'notes' => str_repeat('x', 1000)];
    }
    $this->postJson($this->url, ['base_revision' => 0, 'intervals' => $intervals])->assertOk()->assertJsonCount(100, 'data.intervals');
    $this->getJson($this->url)->assertOk()->assertJsonPath('data.intervals.99.notes', str_repeat('x', 1000));
    expect(strlen(DB::table('rc_annotation_revisions')->value('intervals')))->toBeGreaterThan(65535);
});

it('refuses corrupt manifests before writing a revision', function () {
    Storage::disk('local')->put($this->record->manifest_path, 'invalid ciphertext');
    $this->postJson($this->url, $this->input)->assertStatus(503);
    $this->assertDatabaseCount('rc_annotation_revisions', 0);
});
