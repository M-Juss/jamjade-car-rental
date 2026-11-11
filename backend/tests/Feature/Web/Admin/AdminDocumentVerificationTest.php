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

it('allows admins to unverify with a reason and verify again', function () {
    $document = pendingCustomerDocument();
    $document->update(['status' => DocumentStatus::Approved]);
    $this->actingAs(documentReviewer());
    $this->postJson("/admin/document-verification/{$document->id}/reject", [])->assertUnprocessable();
    $this->postJson("/admin/document-verification/{$document->id}/reject", ['rejection_reason' => 'Document is no longer valid.'])
        ->assertOk()->assertJsonPath('data.statusKey', 'rejected');
    $this->postJson("/admin/document-verification/{$document->id}/approve")
        ->assertOk()->assertJsonPath('data.statusKey', 'approved');
});

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

    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $this->actingAs($staff)
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

it('validates verification queue filters and page size', function () {
    $this->actingAs(documentReviewer())
        ->getJson('/admin/document-verification?status=unknown&per_page=101')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['status', 'per_page']);
});

it('requires a non-empty rejection reason', function () {
    $document = pendingCustomerDocument();

    $this->actingAs(documentReviewer())
        ->postJson("/admin/document-verification/{$document->id}/reject", [
            'rejection_reason' => '   ',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('rejection_reason');
});

it('lists every customer and separates pending review from self-drive eligibility', function () {
    $withoutDocuments = documentCustomerUser();
    $pendingCustomer = documentCustomerUser();
    $pendingCustomer->documents()->create([
        'document_type' => CustomerDocument::DRIVERS_LICENSE,
        'status' => DocumentStatus::Pending,
        'submitted_at' => now(),
    ]);
    $approvedCustomer = documentCustomerUser();
    addCustomerEmergencyContact($approvedCustomer);
    foreach (CustomerDocument::REQUIRED_SELF_DRIVE_DOCUMENTS as $type) {
        $approvedCustomer->documents()->create([
            'document_type' => $type,
            'status' => DocumentStatus::Approved,
            'submitted_at' => now(),
        ]);
    }

    $response = $this->actingAs(documentReviewer())
        ->getJson('/admin/self-drive-verification/customers?per_page=2')
        ->assertOk()
        ->assertJsonPath('meta.summary.total', 3)
        ->assertJsonPath('meta.summary.eligible', 1)
        ->assertJsonPath('meta.total', 3)
        ->assertJsonCount(2, 'data');

    $this->getJson('/admin/self-drive-verification/customers?eligibility=eligible')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.id', $approvedCustomer->id)
        ->assertJsonPath('data.0.reviewStatus', 'eligible')
        ->assertJsonMissingPath('data.0.documents');

    $this->getJson('/admin/self-drive-verification/customers?eligibility=not_eligible')
        ->assertOk()
        ->assertJsonPath('meta.total', 2)
        ->assertJsonFragment(['id' => $withoutDocuments->id, 'reviewStatus' => 'documents_required'])
        ->assertJsonFragment(['id' => $pendingCustomer->id, 'reviewStatus' => 'pending_review']);
});

it('ignores legacy passport requirements and preserves old documents outside the active review', function () {
    $customer = documentCustomerUser();
    addCustomerEmergencyContact($customer);
    $customer->customerProfile()->update(['passport_required' => true]);

    foreach (CustomerDocument::REQUIRED_SELF_DRIVE_DOCUMENTS as $type) {
        $customer->documents()->create(['document_type' => $type, 'status' => DocumentStatus::Approved]);
    }

    $passport = $customer->documents()->create(['document_type' => CustomerDocument::PASSPORT, 'status' => DocumentStatus::Pending]);

    $this->actingAs(documentReviewer())
        ->getJson("/admin/self-drive-verification/customers/{$customer->id}")
        ->assertOk()
        ->assertJsonPath('data.canSelfDrive', true)
        ->assertJsonPath('data.requiredDocumentCount', 2)
        ->assertJsonPath('data.documentCounts.missing', 0)
        ->assertJsonCount(2, 'data.documents');

    $this->getJson('/admin/self-drive-verification/customers?eligibility=eligible')
        ->assertOk()
        ->assertJsonPath('meta.total', 1);

    $this->getJson('/admin/document-verification?per_page=100')
        ->assertOk()
        ->assertJsonCount(2, 'data');

    Sanctum::actingAs($customer);
    $this->getJson('/api/mobile/profile')
        ->assertOk()
        ->assertJsonPath('data.profile.canSelfDrive', true)
        ->assertJsonPath('data.profile.verificationStatus', 'approved')
        ->assertJsonPath('data.selfDriveAvailability.canSelfDrive', true)
        ->assertJsonCount(2, 'data.documents')
        ->assertJsonCount(2, 'data.selfDriveAvailability.requiredDocuments');

    expect($passport->fresh()->status)->toBe(DocumentStatus::Pending);
    expect($customer->customerProfile()->first()->passport_required)->toBeTrue();
});

it('does not treat approved documents as self-drive eligibility without the required age', function () {
    $customer = documentCustomerUser();
    addCustomerEmergencyContact($customer);
    $customer->customerProfile()->update(['birthdate' => now()->subYears(17)->toDateString()]);

    foreach (CustomerDocument::REQUIRED_SELF_DRIVE_DOCUMENTS as $type) {
        $customer->documents()->create(['document_type' => $type, 'status' => DocumentStatus::Approved]);
    }

    $this->actingAs(documentReviewer())
        ->getJson('/admin/self-drive-verification/customers?eligibility=not_eligible&search='.$customer->email)
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.canSelfDrive', false)
        ->assertJsonPath('data.0.reviewStatus', 'age_ineligible')
        ->assertJsonPath('data.0.documentCounts.approved', 2);
});

it('moves a customer from pending review to eligible after the final required approval', function () {
    $customer = documentCustomerUser();
    addCustomerEmergencyContact($customer);
    $customer->documents()->create([
        'document_type' => CustomerDocument::DRIVERS_LICENSE,
        'status' => DocumentStatus::Approved,
    ]);
    $bill = $customer->documents()->create([
        'document_type' => CustomerDocument::PROOF_OF_BILLING,
        'status' => DocumentStatus::Pending,
    ]);
    $reviewer = documentReviewer();

    $this->actingAs($reviewer)
        ->getJson("/admin/self-drive-verification/customers/{$customer->id}")
        ->assertJsonPath('data.reviewStatus', 'pending_review')
        ->assertJsonPath('data.canSelfDrive', false);

    $this->postJson("/admin/document-verification/{$bill->id}/approve")
        ->assertOk()
        ->assertJsonPath('data.documentType', CustomerDocument::PROOF_OF_BILLING)
        ->assertJsonPath('data.name', 'Proof of Address');

    $this->getJson('/admin/self-drive-verification/customers?eligibility=eligible')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.id', $customer->id)
        ->assertJsonPath('data.0.canSelfDrive', true);
});

it('requires a complete emergency contact in the self-drive list and customer details', function () {
    $customer = customerUser();
    $customer->emergencyContacts()->delete();
    $customer->emergencyContacts()->create([
        'name' => 'Maria Dela Cruz',
        'relationship' => ' ',
        'phone_number' => '09123456789',
    ]);
    $this->actingAs(documentReviewer());

    $this->getJson('/admin/self-drive-verification/customers?eligibility=not_eligible')
        ->assertOk()
        ->assertJsonPath('meta.summary.eligible', 0)
        ->assertJsonPath('data.0.id', $customer->id)
        ->assertJsonPath('data.0.reviewStatus', 'emergency_contact_required')
        ->assertJsonMissingPath('data.0.emergencyContacts');
    $this->getJson("/admin/self-drive-verification/customers/{$customer->id}")
        ->assertOk()
        ->assertJsonPath('data.canSelfDrive', false)
        ->assertJsonPath('data.reviewStatus', 'emergency_contact_required')
        ->assertJsonPath('data.documentCounts.approved', 2);

    $customer->emergencyContacts()->update(['relationship' => 'Parent']);
    $this->getJson('/admin/self-drive-verification/customers?eligibility=eligible')
        ->assertOk()
        ->assertJsonPath('meta.summary.eligible', 1)
        ->assertJsonPath('data.0.id', $customer->id)
        ->assertJsonPath('data.0.reviewStatus', 'eligible');
});

it('validates customer filters and restricts the new list to document reviewers', function () {
    $this->actingAs(documentReviewer())
        ->getJson('/admin/self-drive-verification/customers?eligibility=unknown&per_page=101')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['eligibility', 'per_page']);

    $customer = documentCustomerUser();
    $this->actingAs($customer)
        ->getJson('/admin/self-drive-verification/customers')
        ->assertForbidden();
});
