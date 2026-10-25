<?php

use App\Models\RcResearchTrial;
use App\Models\User;
use App\Services\RcResearchService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

function inspectionTrial(User $user, string $name = 'Concrete trial'): RcResearchTrial
{
    $research = app(RcResearchService::class);
    $session = $research->createSession($user, [
        'name' => $name, 'surface' => 'Concrete', 'slope' => 'level', 'mount_orientation' => 'tilted',
        'battery_condition' => 'full', 'platform' => 'android', 'app_version' => '1.0.0',
    ]);
    $samples = [];
    for ($i = 0; $i <= 10; $i++) {
        $samples[] = ['elapsed_ms' => $i * 100, 'acceleration_timestamp_s' => 100 + $i / 10,
            'gravity_timestamp_s' => 100 + $i / 10, 'rotation_timestamp_s' => 100 + $i / 10,
            'linear_x' => 1, 'linear_y' => 0, 'linear_z' => 0,
            'including_gravity_x' => 1, 'including_gravity_y' => 0, 'including_gravity_z' => 9.80665,
            'rotation_x' => 0, 'rotation_y' => 0, 'rotation_z' => 2, 'orientation' => 0];
    }

    return $research->storeTrial($session, [
        'client_trial_id' => 'test-recording', 'protocol_version' => 1,
        'intended_movement' => 'braking', 'intended_intensity' => 'normal',
        'observed_movement' => 'braking', 'observed_intensity' => 'normal',
        'label_status' => 'uncertain', 'quality' => 'usable', 'event_start_ms' => 100, 'event_end_ms' => 800,
        'started_at' => now()->subSeconds(1)->toISOString(), 'ended_at' => now()->toISOString(),
    ], $samples);
}

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    config(['telematics.calibration_profile' => 'rc_demo']);
    Storage::fake('local');
    $this->admin = User::factory()->create(['is_active' => true]);
    $this->admin->assignRole('admin');
});

it('reads only the signed-in Admin recordings and returns verified original measurements separately', function () {
    $trial = inspectionTrial($this->admin);
    $other = User::factory()->create(['is_active' => true]);
    $other->assignRole('admin');
    $otherTrial = inspectionTrial($other);
    $this->actingAs($this->admin, 'web');

    $this->getJson('/admin/rc-research/trials')->assertOk()->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $trial->id)->assertJsonMissingPath('data.0.samples')
        ->assertJsonMissingPath('data.0.samples_path')->assertHeader('Cache-Control', 'no-store, private');
    $this->getJson("/admin/rc-research/trials/$trial->id")->assertOk()
        ->assertJsonPath('data.source', 'expo_device_motion_v1')->assertJsonPath('data.coordinate_frame', 'phone')
        ->assertJsonPath('data.units.rotation', 'deg/s')->assertJsonPath('data.processing', null)
        ->assertJsonPath('data.reference', null)->assertJsonPath('data.samples.0.linear_x', 1)
        ->assertJsonPath('data.content_sha256', $trial->content_hash)->assertJsonCount(11, 'data.samples')
        ->assertJsonMissingPath('data.trial.samples_path')->assertHeader('Cache-Control', 'no-store, private');
    $this->getJson("/admin/rc-research/trials/$otherTrial->id")->assertNotFound();
    $trial->session->update(['app_version' => 'synthetic-demo']);
    $this->getJson("/admin/rc-research/trials/$trial->id")->assertOk()
        ->assertJsonPath('data.source', 'synthetic_demo_v1');
});

it('paginates and filters research reads using validated query parameters', function () {
    for ($index = 0; $index < 11; $index++) {
        inspectionTrial($this->admin, $index === 0 ? 'Special 100% trial' : "Session $index");
    }
    $this->actingAs($this->admin, 'web');
    $this->getJson('/admin/rc-research/trials')->assertOk()->assertJsonCount(10, 'data')->assertJsonPath('meta.total', 11);
    $this->getJson('/admin/rc-research/trials?page=2')->assertOk()->assertJsonCount(1, 'data');
    $this->getJson('/admin/rc-research/trials?search=100%25')->assertOk()->assertJsonCount(1, 'data');
    $this->getJson('/admin/rc-research/trials?label_status=confirmed')->assertOk()->assertJsonCount(0, 'data');
    $this->getJson('/admin/rc-research/trials?per_page=11&page=0&label_status=guessed')->assertUnprocessable()
        ->assertJsonValidationErrors(['per_page', 'page', 'label_status']);
});

it('denies research reads to non-Admin, inactive and RC-disabled web sessions', function (string $kind) {
    $trial = inspectionTrial($this->admin);
    if ($kind === 'disabled') {
        config(['telematics.calibration_profile' => 'standard']);
        $user = $this->admin;
    } else {
        $user = User::factory()->create(['is_active' => $kind !== 'inactive']);
        $user->assignRole($kind === 'inactive' ? 'admin' : $kind);
    }
    $this->actingAs($user, 'web');
    $this->getJson('/admin/rc-research/trials')->assertForbidden();
    $this->actingAs($user, 'web')->getJson("/admin/rc-research/trials/$trial->id")->assertForbidden();
})->with(['staff', 'driver', 'customer', 'inactive', 'disabled']);

it('does not authorize the web inspector with a mobile research bearer token', function () {
    $this->withToken($this->admin->createToken('research', ['rc-research'])->plainTextToken)
        ->getJson('/admin/rc-research/trials')->assertUnauthorized();
});

it('does not return deleted, missing or corrupted recording contents', function (string $kind) {
    $trial = inspectionTrial($this->admin);
    if ($kind === 'deleted') {
        app(RcResearchService::class)->deleteTrial($trial);
    } elseif ($kind === 'missing') {
        Storage::disk('local')->delete($trial->samples_path);
    } elseif ($kind === 'encrypted') {
        Storage::disk('local')->put($trial->samples_path, 'broken ciphertext');
    } else {
        Storage::disk('local')->put($trial->samples_path, Crypt::encryptString('{"samples":["changed"]}'));
    }
    $this->actingAs($this->admin, 'web')->getJson("/admin/rc-research/trials/$trial->id")
        ->assertStatus($kind === 'deleted' ? 404 : 503)->assertJsonMissingPath('data.samples');
})->with(['deleted', 'missing', 'encrypted', 'hash']);

it('does not grant the web session access to the mobile research endpoints', function () {
    $this->actingAs($this->admin, 'web')->getJson('/api/mobile/rc-research/trials')->assertForbidden();
});
