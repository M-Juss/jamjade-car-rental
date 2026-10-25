<?php

use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    config(['telematics.calibration_profile' => 'rc_demo']);
    $this->admin = User::factory()->create(['is_active' => true]);
    $this->admin->assignRole('admin');
});

it('bounds local capture authority to the current research token without enabling upload', function () {
    $this->travelTo(now()->startOfSecond());
    $expires = now()->addMinutes(3);
    $token = $this->admin->createToken('research', ['rc-research'], $expires);
    $this->withToken($token->plainTextToken)->getJson('/api/mobile/rc-research/native-access')->assertOk()
        ->assertJsonPath('data.owner_id', (string) $this->admin->id)->assertJsonPath('data.valid_for_seconds', 180)
        ->assertJsonPath('data.expires_at', $expires->toISOString())->assertJsonPath('data.upload_available', false)
        ->assertJsonPath('data.capture_protocol_version', 2)->assertJsonMissingPath('data.token')
        ->assertHeader('Cache-Control', 'no-store, private');
    $this->assertDatabaseCount('rc_research_sessions', 0);
    $this->assertDatabaseCount('telematics_trips', 0);
});

it('rejects nonexpiring, wrong-scope, non-Admin and disabled-profile native access', function (string $kind) {
    if ($kind === 'staff') {
        $this->admin->syncRoles('staff');
    }
    if ($kind === 'inactive') {
        $this->admin->update(['is_active' => false]);
    }
    if ($kind === 'profile') {
        config(['telematics.calibration_profile' => 'standard']);
    }
    $token = $this->admin->createToken('research', [$kind === 'scope' ? 'mobile' : 'rc-research'], $kind === 'nonexpiring' ? null : now()->addMinutes(5));
    $this->withToken($token->plainTextToken)->getJson('/api/mobile/rc-research/native-access')->assertForbidden();
})->with(['staff', 'inactive', 'profile', 'scope', 'nonexpiring']);

it('also respects the global Sanctum lifetime and the eight-hour native lease cap', function (bool $global) {
    $this->travelTo(now()->startOfSecond());
    config(['sanctum.expiration' => $global ? 5 : null]);
    $token = $this->admin->createToken('research', ['rc-research'], now()->addDay());
    $token->accessToken->forceFill(['created_at' => now()->subMinutes(4)])->save();
    $this->withToken($token->plainTextToken)->getJson('/api/mobile/rc-research/native-access')->assertOk()
        ->assertJsonPath('data.valid_for_seconds', $global ? 60 : 28800);
})->with([true, false]);

it('does not accept web sessions or expired research tokens', function (string $kind) {
    if ($kind === 'web') {
        $this->actingAs($this->admin, 'web');
    } else {
        $this->withToken($this->admin->createToken('research', ['rc-research'], now()->subSecond())->plainTextToken);
    }
    $this->getJson('/api/mobile/rc-research/native-access')->assertStatus($kind === 'web' ? 403 : 401);
})->with(['web', 'expired']);
