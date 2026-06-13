<?php

use App\Enums\DocumentStatus;
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
});

function documentReviewer(): User
{
    $admin = User::factory()->create();
    $admin->assignRole(UserRole::Admin->value);

    return $admin;
}

function pendingCustomerDocument(string $documentType = CustomerDocument::DRIVERS_LICENSE): CustomerDocument
{
    $customer = documentCustomerUser();

    return $customer->documents()->create([
        'document_type' => $documentType,
        'document_number' => $documentType === CustomerDocument::DRIVERS_LICENSE ? 'N01-23-456789' : null,
        'expires_at' => $documentType === CustomerDocument::DRIVERS_LICENSE ? now()->addYear() : null,
        'file_path' => "customer-documents/{$customer->id}/document.jpg",
        'front_file_path' => "customer-documents/{$customer->id}/document-front.jpg",
        'back_file_path' => "customer-documents/{$customer->id}/document-back.jpg",
        'status' => DocumentStatus::Pending,
        'submitted_at' => now(),
    ]);
}

it('returns document sides and customer details to the verification queue', function () {
    $document = pendingCustomerDocument();

    $this->actingAs(documentReviewer())
        ->getJson('/admin/document-verification?per_page=100')
        ->assertOk()
        ->assertJsonPath('data.0.id', $document->id)
        ->assertJsonPath('data.0.statusKey', 'pending')
        ->assertJsonPath('data.0.customer.name', 'Document Customer')
        ->assertJsonPath('data.0.frontFileUrl', fn ($url) => str_contains($url, 'document-front.jpg'))
        ->assertJsonPath('data.0.backFileUrl', fn ($url) => str_contains($url, 'document-back.jpg'));
});

it('approves a pending document and notifies the customer', function () {
    $document = pendingCustomerDocument();
    $reviewer = documentReviewer();

    $this->actingAs($reviewer)
        ->postJson("/admin/document-verification/{$document->id}/approve")
        ->assertOk()
        ->assertJsonPath('data.statusKey', 'approved')
        ->assertJsonPath('data.reviewedBy', $reviewer->name);

    $this->assertDatabaseHas('notifications', [
        'user_id' => $document->user_id,
        'customer_document_id' => $document->id,
        'type' => 'document_verification',
        'priority' => 'success',
        'title' => "Driver's License verification approved",
        'message' => "Approved: Jamjade accepted your Driver's License.",
    ]);
});

it('rejects a pending document with a reason and allows resubmission', function () {
    Storage::fake('public');
    $document = pendingCustomerDocument();
    $customer = $document->user;
    $reviewer = documentReviewer();

    $this->actingAs($reviewer)
        ->postJson("/admin/document-verification/{$document->id}/reject", [
            'rejection_reason' => 'The back image is blurry.',
        ])
        ->assertOk()
        ->assertJsonPath('data.statusKey', 'rejected')
        ->assertJsonPath('data.rejectionReason', 'The back image is blurry.');

    $this->assertDatabaseHas('notifications', [
        'user_id' => $document->user_id,
        'customer_document_id' => $document->id,
        'priority' => 'warning',
        'title' => "Driver's License verification not accepted",
        'message' => 'Not accepted: The back image is blurry.',
    ]);

    $this->actingAs($reviewer)
        ->postJson("/admin/document-verification/{$document->id}/approve")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');

    Sanctum::actingAs($customer);

    $this->getJson('/api/mobile/profile')
        ->assertOk()
        ->assertJsonPath('data.profile.verificationStatus', 'rejected')
        ->assertJsonPath('data.documents.0.statusKey', 'rejected')
        ->assertJsonPath('data.documents.0.rejectionReason', 'The back image is blurry.');

    $this->getJson('/api/mobile/notifications')
        ->assertOk()
        ->assertJsonPath('data.0.title', "Driver's License verification not accepted")
        ->assertJsonPath('data.0.actionLabel', 'Upload Corrected Document')
        ->assertJsonPath('data.0.data.action', 'resubmit_document')
        ->assertJsonPath('data.0.data.documentType', CustomerDocument::DRIVERS_LICENSE)
        ->assertJsonPath('data.0.data.documentStatus', 'rejected')
        ->assertJsonPath('data.0.data.rejectionReason', 'The back image is blurry.');

    $this->post('/api/mobile/documents/upload', [
        'document_type' => CustomerDocument::DRIVERS_LICENSE,
        'document_number' => 'N01-23-456789',
        'expires_at' => now()->addYear()->toDateString(),
        'front_file' => UploadedFile::fake()->image('corrected-front.jpg')->size(512),
        'back_file' => UploadedFile::fake()->image('corrected-back.jpg')->size(512),
    ], ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('data.id', $document->id)
        ->assertJsonPath('data.statusKey', 'pending')
        ->assertJsonPath('data.rejectionReason', null);

    $this->assertDatabaseCount('customer_documents', 1);
    $this->assertDatabaseHas('customer_profiles', [
        'user_id' => $customer->id,
        'can_self_drive' => false,
        'verification_status' => 'pending_review',
    ]);
});

it('hides legacy valid ID records from the active verification queue', function () {
    pendingCustomerDocument(CustomerDocument::VALID_ID);

    $this->actingAs(documentReviewer())
        ->getJson('/admin/document-verification?per_page=100')
        ->assertOk()
        ->assertJsonCount(0, 'data');
});
