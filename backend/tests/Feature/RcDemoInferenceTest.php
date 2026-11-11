<?php

use App\Models\User;
use App\Services\RcDemoInferenceService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    config(['telematics.calibration_profile' => 'rc_demo']);
    $this->admin = User::factory()->create(['is_active' => true]);
    $this->admin->assignRole('admin');
    $this->payload = ['version' => 'rc-demo-inference-v1',
        'windows' => [['id' => 'window-1', 'features' => array_fill(0, 35, 0.0)]]];
});

it('returns an authorized private prediction', function () {
    $result = ['version' => 'rc-demo-inference-v1', 'model_sha256' => RcDemoInferenceService::MODEL_SHA256,
        'predictions' => [['id' => 'window-1', 'class' => 'normal_motion', 'vote' => 0.8]]];
    $this->mock(RcDemoInferenceService::class)->shouldReceive('predict')->once()->with($this->payload)->andReturn($result);
    $this->actingAs($this->admin, 'web')->postJson('/admin/rc-research/demo/inference', $this->payload)
        ->assertOk()->assertJsonPath('data.predictions.0.class', 'normal_motion')
        ->assertHeader('Cache-Control', 'no-store, private');
});

it('rejects invalid feature vectors', function () {
    $this->payload['windows'][0]['features'][0] = true;
    $this->actingAs($this->admin, 'web')->postJson('/admin/rc-research/demo/inference', $this->payload)
        ->assertUnprocessable()->assertJsonValidationErrors('windows.0.features.0');
});

it('requires an admin session', function () {
    $this->postJson('/admin/rc-research/demo/inference', $this->payload)->assertUnauthorized();
    $user = User::factory()->create(['is_active' => true]);
    $this->actingAs($user, 'web')->postJson('/admin/rc-research/demo/inference', $this->payload)->assertForbidden();
});

it('allows only a restricted Admin research token on the mobile inference route', function () {
    $url = '/api/mobile/rc-research/drive-monitoring/inference';
    $this->postJson($url, $this->payload)->assertUnauthorized();
    $token = $this->admin->createToken('research', ['rc-research'])->plainTextToken;
    $result = ['version' => 'rc-demo-inference-v1', 'model_sha256' => RcDemoInferenceService::MODEL_SHA256,
        'predictions' => [['id' => 'window-1', 'class' => 'normal_motion', 'vote' => 0.8]]];
    $this->mock(RcDemoInferenceService::class)->shouldReceive('predict')->once()->andReturn($result);
    $this->withToken($token)->postJson($url, $this->payload)->assertOk();
});
