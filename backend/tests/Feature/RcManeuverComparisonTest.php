<?php

use App\Models\RcAnnotationRevision;
use App\Models\RcCollectionContext;
use App\Models\RcCollectionSession;
use App\Models\RcMountVersion;
use App\Models\RcNativeRecording;
use App\Models\RcObservationRevision;
use App\Models\RcProcessingRun;
use App\Models\User;
use App\Services\RcMotionProcessing;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

const MANEUVER_COMPARISON_PATH = '/admin/rc-research/model-explorer/maneuvers';

beforeEach(function () {
    $this->app->detectEnvironment(fn () => 'local');
    $this->withHeader('Sec-Fetch-Site', 'same-origin');
    $this->seed(RoleAndPermissionSeeder::class);
    config(['telematics.calibration_profile' => 'rc_demo']);
    Storage::fake('local');
    $this->admin = User::factory()->create(['is_active' => true]);
    $this->admin->assignRole('admin');
});

it('opens hosted Model Explorer only after explicit RC demo opt-in', function () {
    $this->app->detectEnvironment(fn () => 'production');
    config(['telematics.hosted_rc_demo' => false]);
    $this->actingAs($this->admin, 'web')->getJson(MANEUVER_COMPARISON_PATH)->assertForbidden();
    config(['telematics.hosted_rc_demo' => true]);
    $this->getJson(MANEUVER_COMPARISON_PATH)->assertOk()->assertJsonCount(0, 'data.recordings');

    $other = User::factory()->create(['is_active' => true]);
    $recording = comparisonRecording($other);
    $annotation = comparisonAnnotation($recording);
    $this->getJson(MANEUVER_COMPARISON_PATH)->assertOk()->assertJsonCount(0, 'data.recordings');
    $this->getJson(MANEUVER_COMPARISON_PATH.'/'.$recording->id.'/'.$annotation->id.'/0')->assertNotFound();
});

function comparisonRecording(User $owner): RcNativeRecording
{
    return RcNativeRecording::create([
        'user_id' => $owner->id, 'client_recording_id' => (string) Str::uuid(), 'name' => 'Maneuver trial',
        'surface' => 'tiles', 'state' => 'verified', 'capture_state' => 'stopped', 'manifest_path' => 'private/manifest',
        'manifest_sha256' => str_repeat('a', 64), 'expected_chunks' => 1, 'expected_bytes' => 100,
        'duration_ms' => 1000, 'started_at' => now(),
    ]);
}

function comparisonAnnotation(RcNativeRecording $recording, ?array $intervals = null): RcAnnotationRevision
{
    return $recording->annotationRevisions()->create([
        'reviewer_id' => $recording->user_id, 'revision' => 1, 'state' => 'uncertain',
        'manifest_sha256' => $recording->manifest_sha256, 'fingerprint' => str_repeat('b', 64),
        'intervals' => $intervals ?? [
            ['start_ms' => 600, 'end_ms' => 640, 'movement' => 'left_turn', 'direction' => 'forward', 'severity' => 'normal', 'certainty' => 'reviewed'],
            ['start_ms' => 640, 'end_ms' => 680, 'movement' => 'right_turn', 'direction' => 'forward', 'severity' => 'harsh', 'certainty' => 'reviewed'],
            ['start_ms' => 680, 'end_ms' => 700, 'movement' => 'acceleration', 'direction' => 'forward', 'severity' => 'normal', 'certainty' => 'uncertain'],
        ],
    ]);
}

function comparisonObservation(RcNativeRecording $recording, int $revision): RcObservationRevision
{
    return RcObservationRevision::create([
        'id' => (string) Str::uuid(), 'recording_id' => $recording->id, 'user_id' => $recording->user_id, 'revision' => $revision,
        'payload' => ['flags' => ['cone_contact']], 'content_sha256' => str_repeat('c', 64), 'created_at' => now(),
    ]);
}

function comparisonProcessingRun(RcNativeRecording $recording): void
{
    $reference = RcProcessingRun::create([
        'recording_id' => $recording->id, 'version' => RcMotionProcessing::VERSION, 'cutoff_hz' => 5,
        'fingerprint' => str_repeat('d', 64), 'payload_path' => 'private/reference', 'payload_sha256' => str_repeat('e', 64),
    ]);
    $result = [
        'source' => ['recording_id' => $recording->id, 'manifest_sha256' => $recording->manifest_sha256],
        'settings' => ['grid_ms' => 20], 'config' => ['start_ms' => 0, 'end_ms' => 1000],
    ];
    foreach (range(0, 1000, 20) as $time) {
        $timestamp = (string) (1000000000 + $time * 1000000);
        $after = $time === 620 ? (string) ((int) $timestamp + 25000000) : $timestamp;
        $result['rows'][] = ['time' => $time, 'sensor_timestamp_ns' => $timestamp,
            'acceleration' => ['state' => $time === 620 ? 'interpolated' : 'original', 'source_times_ns' => [$timestamp, $after]],
            'gyroscope' => ['state' => 'original', 'source_times_ns' => [$timestamp, $timestamp]]];
        $result['signals']['acceleration']['after'][] = ['time' => $time, 'x' => 1, 'y' => -3, 'z' => 0];
        $result['signals']['gyroscope']['after'][] = ['time' => $time, 'x' => 0, 'y' => 0, 'z' => -2];
        $result['signals']['acceleration']['warmup'][] = $time < 500;
        $result['signals']['gyroscope']['warmup'][] = $time < 500;
    }
    $payload = json_encode($result, JSON_THROW_ON_ERROR);
    Storage::disk('local')->put('private/processing', Crypt::encryptString($payload));
    RcProcessingRun::create([
        'recording_id' => $recording->id, 'version' => RcMotionProcessing::REUSE_VERSION, 'cutoff_hz' => 5,
        'reference_run_id' => $reference->id, 'fingerprint' => str_repeat('f', 64), 'payload_path' => 'private/processing',
        'payload_sha256' => hash('sha256', $payload),
    ]);
}

it('retains reviewed events while requiring pre-contact intervals and pre-contact source samples for measurements', function () {
    $recording = comparisonRecording($this->admin);
    $annotation = comparisonAnnotation($recording);
    $observation = comparisonObservation($recording, 1);
    comparisonProcessingRun($recording);
    $contactPath = MANEUVER_COMPARISON_PATH.'/'.$recording->id.'/contact';
    $signalPath = MANEUVER_COMPARISON_PATH.'/'.$recording->id.'/'.$annotation->id.'/0';
    $this->actingAs($this->admin, 'web')->getJson(MANEUVER_COMPARISON_PATH)->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private')->assertJsonCount(2, 'data.events')
        ->assertJsonPath('data.recordings.0.contact_status', 'review_needed')->assertJsonPath('data.events.0.measurements', null);
    $this->putJson($contactPath, ['observation_revision_id' => $observation->id, 'first_contact_ms' => 645])->assertOk();
    $this->getJson($signalPath)->assertConflict();
    $this->putJson($contactPath, ['observation_revision_id' => $observation->id, 'first_contact_ms' => 680])->assertOk();
    $this->getJson(MANEUVER_COMPARISON_PATH)->assertOk()->assertJsonCount(2, 'data.events')
        ->assertJsonPath('data.events.0.direction', 'left')->assertJsonPath('data.events.0.measurements.peak_turn_rate', 2)
        ->assertJsonPath('data.events.0.measurements.peak_lateral_acceleration', 3)->assertJsonPath('data.events.0.measurements.duration', 0.04)
        ->assertJsonPath('data.events.1.severity', 'harsh')->assertJsonPath('data.events.1.measurements', null);
    $this->getJson($signalPath)->assertOk()->assertJsonCount(2, 'data.samples')
        ->assertJsonPath('data.samples.1', [0.02, 1, -3, 0, 0, 0, -2]);

    comparisonObservation($recording, 2);
    $this->getJson($signalPath)->assertConflict();
    $this->getJson(MANEUVER_COMPARISON_PATH)->assertOk()->assertJsonCount(2, 'data.events')
        ->assertJsonPath('data.recordings.0.contact_status', 'review_needed')->assertJsonPath('data.events.0.measurements', null);
    $this->putJson($contactPath, ['observation_revision_id' => $observation->id, 'first_contact_ms' => 700])->assertConflict();
});

it('validates contact times and restricts private recording reads and updates to the owner', function () {
    $own = comparisonRecording($this->admin);
    comparisonAnnotation($own);
    $other = comparisonRecording(User::factory()->create());
    $otherAnnotation = comparisonAnnotation($other);
    $this->getJson(MANEUVER_COMPARISON_PATH)->assertUnauthorized();
    $this->actingAs($this->admin, 'web')->getJson(MANEUVER_COMPARISON_PATH)->assertOk()
        ->assertJsonCount(1, 'data.recordings')->assertJsonPath('data.recordings.0.id', $own->id)
        ->assertJsonPath('data.events.0.measurements', null);
    $this->getJson(MANEUVER_COMPARISON_PATH.'/'.$other->id.'/'.$otherAnnotation->id.'/0')->assertNotFound();
    $this->putJson(MANEUVER_COMPARISON_PATH.'/'.$other->id.'/contact', ['observation_revision_id' => null, 'first_contact_ms' => 700])->assertNotFound();
    $path = MANEUVER_COMPARISON_PATH.'/'.$own->id.'/contact';
    $this->putJson($path, ['observation_revision_id' => null, 'first_contact_ms' => 1001])->assertUnprocessable()->assertJsonValidationErrors('first_contact_ms');
    $this->putJson($path, ['observation_revision_id' => null, 'first_contact_ms' => 700])->assertOk();
    $this->putJson($path, ['observation_revision_id' => null, 'first_contact_ms' => null])->assertOk();
    $this->assertDatabaseMissing('rc_maneuver_contact_reviews', ['recording_id' => $own->id]);
});

it('measures longitudinal motion relative to the reviewed travel direction and excludes warm-up', function () {
    $recording = comparisonRecording($this->admin);
    comparisonAnnotation($recording, [
        ['start_ms' => 480, 'end_ms' => 520, 'movement' => 'acceleration', 'direction' => 'forward', 'severity' => 'normal', 'certainty' => 'reviewed'],
        ['start_ms' => 600, 'end_ms' => 640, 'movement' => 'acceleration', 'direction' => 'forward', 'severity' => 'normal', 'certainty' => 'reviewed'],
        ['start_ms' => 640, 'end_ms' => 680, 'movement' => 'braking', 'direction' => 'reverse', 'severity' => 'harsh', 'certainty' => 'reviewed'],
    ]);
    comparisonProcessingRun($recording);

    $this->actingAs($this->admin, 'web')->getJson(MANEUVER_COMPARISON_PATH)->assertOk()
        ->assertJsonCount(3, 'data.events')->assertJsonPath('data.events.0.measurements', null)
        ->assertJsonPath('data.events.1.maneuver', 'acceleration')->assertJsonPath('data.events.1.measurements.peak_longitudinal_acceleration', 1)
        ->assertJsonPath('data.events.2.maneuver', 'braking')->assertJsonPath('data.events.2.direction', 'reverse')
        ->assertJsonPath('data.events.2.measurements.peak_longitudinal_acceleration', 1);
});

it('compares reviewed swerves separately and excludes legacy lane-change labels', function () {
    $recording = comparisonRecording($this->admin);
    $session = RcCollectionSession::create([
        'id' => (string) Str::uuid(), 'user_id' => $this->admin->id, 'device_profile_id' => (string) Str::uuid(),
        'session_number' => 1, 'payload' => [], 'content_sha256' => str_repeat('a', 64),
    ]);
    $mount = RcMountVersion::create([
        'id' => (string) Str::uuid(), 'session_id' => $session->id, 'mount_number' => 1,
        'payload' => [], 'content_sha256' => str_repeat('a', 64),
    ]);
    $context = RcCollectionContext::create([
        'recording_id' => $recording->id, 'mount_id' => $mount->id, 'preflight_id' => (string) Str::uuid(),
        'capture_number' => 1, 'display_code' => 'S01-SW-R001', 'content_sha256' => str_repeat('a', 64),
        'payload' => ['protocol_code' => 'SW', 'catalog_version' => 'rc-exercises-v6'],
    ]);
    comparisonAnnotation($recording, [
        ['start_ms' => 600, 'end_ms' => 640, 'movement' => 'swerving', 'direction' => 'forward', 'initial_deviation' => 'right', 'severity' => 'harsh', 'certainty' => 'reviewed'],
        ['start_ms' => 640, 'end_ms' => 680, 'movement' => 'left_turn', 'direction' => 'forward', 'severity' => 'normal', 'certainty' => 'reviewed'],
    ]);
    comparisonProcessingRun($recording);
    $this->actingAs($this->admin, 'web')->getJson(MANEUVER_COMPARISON_PATH)->assertOk()
        ->assertJsonCount(2, 'data.events')->assertJsonPath('data.events.0.maneuver', 'swerving')
        ->assertJsonPath('data.events.0.direction', 'right')->assertJsonPath('data.events.0.measurements.peak_turn_rate', 2)
        ->assertJsonPath('data.events.1.maneuver', 'cornering');
    $context->update(['payload' => ['protocol_code' => 'SW', 'catalog_version' => 'rc-exercises-v3',
        'protocol_snapshot' => ['layout_key' => 'swerve_recovery']]]);
    $this->getJson(MANEUVER_COMPARISON_PATH)->assertOk()->assertJsonCount(1, 'data.events')
        ->assertJsonPath('data.events.0.maneuver', 'cornering');
});
