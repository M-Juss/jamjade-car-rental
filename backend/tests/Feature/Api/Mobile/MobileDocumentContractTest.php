<?php

use App\Enums\UserRole;
use App\Models\CustomerDocument;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Storage::fake('public');
    Sanctum::actingAs(documentCustomerUser());
});

it('normalizes license numbers to uppercase with display hyphens', function (string $input, string $expected) {
    $this->post('/api/mobile/documents/upload', [
        'document_type' => CustomerDocument::DRIVERS_LICENSE,
        'document_number' => $input,
        'expires_at' => now()->addYear()->toDateString(),
        'front_file' => UploadedFile::fake()->image('front.jpg'),
        'back_file' => UploadedFile::fake()->image('back.jpg'),
    ], ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('data.documentNumber', $expected);

    $this->assertDatabaseHas('customer_documents', ['document_number' => $expected]);
})->with([
    ['n0312123456', 'N03-12-123456'],
    [' n03-12-ab3456 ', 'N03-12-AB3456'],
    ['a12b3', 'A12-B3'],
    ['a', 'A'],
    ['n0300000000', 'N03-00-000000'],
]);

it('rejects invalid or overlong license numbers without truncating them', function (string $number) {
    $this->post('/api/mobile/documents/upload', [
        'document_type' => CustomerDocument::DRIVERS_LICENSE,
        'document_number' => $number,
        'expires_at' => now()->addYear()->toDateString(),
        'front_file' => UploadedFile::fake()->image('front.jpg'),
        'back_file' => UploadedFile::fake()->image('back.jpg'),
    ], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('document_number');

    $this->assertDatabaseCount('customer_documents', 0);
})->with(['N03121234567', 'N03-12-1234567', 'N03/12/123456', 'N03 12 123456', '---', '']);

it('still requires both license images', function () {
    $this->post('/api/mobile/documents/upload', [
        'document_type' => CustomerDocument::DRIVERS_LICENSE,
        'document_number' => 'N03-12-123456',
        'expires_at' => now()->addYear()->toDateString(),
        'front_file' => UploadedFile::fake()->image('front.jpg'),
    ], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('back_file');
});

it('stores an optional proof of address back image and exposes it to staff', function () {
    $response = $this->post('/api/mobile/documents/upload', [
        'document_type' => CustomerDocument::PROOF_OF_BILLING,
        'file' => UploadedFile::fake()->create('address.pdf', 512, 'application/pdf'),
        'back_file' => UploadedFile::fake()->image('address-back.jpg'),
    ], ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('data.fileType', 'pdf')
        ->assertJsonPath('data.backFileUrl', fn ($url) => is_string($url) && str_ends_with($url, '.jpg'));

    $document = CustomerDocument::findOrFail($response->json('data.id'));
    Storage::disk('public')->assertExists([$document->file_path, $document->back_file_path]);

    $reviewer = User::factory()->create();
    $reviewer->assignRole(UserRole::Admin->value);
    $this->actingAs($reviewer)->getJson("/admin/self-drive-verification/customers/{$document->user_id}")
        ->assertOk()
        ->assertJsonPath('data.documents.1.document.backFileUrl', $response->json('data.backFileUrl'));
});

it('requires the main proof of address image even when a back image is provided', function () {
    $this->post('/api/mobile/documents/upload', [
        'document_type' => CustomerDocument::PROOF_OF_BILLING,
        'back_file' => UploadedFile::fake()->image('back.jpg'),
    ], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('file');
});

it('validates optional proof of address uploads with the same file limits', function () {
    $this->post('/api/mobile/documents/upload', [
        'document_type' => CustomerDocument::PROOF_OF_BILLING,
        'file' => UploadedFile::fake()->image('address.jpg'),
        'back_file' => UploadedFile::fake()->image('back.jpg')->size(5121),
    ], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('back_file');
});

it('rejects new passport uploads while preserving historical passport records', function () {
    $customer = auth()->user();
    $passport = $customer->documents()->create([
        'document_type' => CustomerDocument::PASSPORT,
        'file_path' => 'customer-documents/legacy-passport.jpg',
        'status' => 'approved',
    ]);

    $this->post('/api/mobile/documents/upload', [
        'document_type' => CustomerDocument::PASSPORT,
        'file' => UploadedFile::fake()->image('passport.jpg'),
    ], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('document_type');

    $this->getJson('/api/mobile/documents')->assertOk()->assertJsonCount(0, 'data');
    expect($passport->fresh()->file_path)->toBe('customer-documents/legacy-passport.jpg');
});
