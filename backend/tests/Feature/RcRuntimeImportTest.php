<?php

use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    config(['telematics.calibration_profile' => 'rc_demo']);
    Storage::fake('local');
    $this->admin = User::factory()->create(['is_active' => true]);
    $this->admin->assignRole('admin');
});

it('requires admin authentication', function () {
    $this->getJson('/admin/rc-research/runtime-import')->assertUnauthorized();
    $staff = User::factory()->create(['is_active' => true]);
    $staff->assignRole('staff');
    $this->actingAs($staff, 'web')->get('/admin/rc-research/runtime-import')->assertForbidden();
});

it('rejects a model with the wrong checksum', function () {
    $this->actingAs($this->admin, 'web')->postJson('/admin/rc-research/runtime-import', [
        'model' => UploadedFile::fake()->createWithContent('model.json', '{}'),
    ])->assertUnprocessable();
    expect(Storage::disk('local')->allFiles())->toBeEmpty();
});

it('does not overwrite an installed model', function () {
    $path = 'rc-research-v2/datasets/models/pilot-split-v3-yaw-forest-v1/runtime-forest-v1.json.encrypted';
    Storage::disk('local')->put($path, 'existing');
    $this->actingAs($this->admin, 'web')->postJson('/admin/rc-research/runtime-import', [
        'model' => UploadedFile::fake()->createWithContent('model.json', '{}'),
    ])->assertConflict();
    expect(Storage::disk('local')->get($path))->toBe('existing');
});
