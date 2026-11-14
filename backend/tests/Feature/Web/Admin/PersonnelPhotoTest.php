<?php

use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Storage::fake('public');
});

it('allows a staff member to update and remove a driver photo', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $driver = User::factory()->create();
    $driver->assignRole('driver');
    $this->actingAs($staff)->postJson("/admin/personnel/users/{$driver->id}/photo", ['photo' => UploadedFile::fake()->image('portrait.jpg')])->assertOk();
    $path = $driver->fresh()->personnel_photo_path;
    Storage::disk('public')->assertExists($path);
    $this->deleteJson("/admin/personnel/users/{$driver->id}/photo")->assertOk();
    Storage::disk('public')->assertMissing($path);
});

it('prevents staff changing their own or staff photos', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $other = User::factory()->create();
    $other->assignRole('staff');
    $this->actingAs($staff)->postJson("/admin/personnel/users/{$staff->id}/photo", ['photo' => UploadedFile::fake()->image('portrait.jpg')])->assertForbidden();
    $this->postJson("/admin/personnel/users/{$other->id}/photo", ['photo' => UploadedFile::fake()->image('portrait.jpg')])->assertForbidden();
});

it('lets the owner manage personnel photos and returns the photo in the signed-in account', function () {
    $owner = User::factory()->create();
    $owner->assignRole(['owner', 'admin']);
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $response = $this->actingAs($owner)->postJson("/admin/personnel/users/{$staff->id}/photo", [
        'photo' => UploadedFile::fake()->image('portrait.jpg'),
    ])->assertOk();
    $url = $response->json('data.user.photoUrl');
    expect($url)->toBeString()->not->toBeEmpty();
    $this->actingAs($staff->fresh())->getJson('/admin/me')->assertOk()->assertJsonPath('data.user.photoUrl', $url);
});

it('rejects invalid personnel photo files', function () {
    $owner = User::factory()->create();
    $owner->assignRole(['owner', 'admin']);
    $driver = User::factory()->create();
    $driver->assignRole('driver');
    $this->actingAs($owner)->postJson("/admin/personnel/users/{$driver->id}/photo", [
        'photo' => UploadedFile::fake()->create('document.pdf', 100, 'application/pdf'),
    ])->assertUnprocessable()->assertJsonValidationErrors('photo');
    $this->postJson("/admin/personnel/users/{$driver->id}/photo", [
        'photo' => UploadedFile::fake()->image('portrait.jpg')->size(5121),
    ])->assertUnprocessable()->assertJsonValidationErrors('photo');
    expect($driver->fresh()->personnel_photo_path)->toBeNull();
});
