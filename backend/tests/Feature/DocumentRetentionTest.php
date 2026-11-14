<?php

use App\Enums\BookingStatus;
use App\Enums\DocumentStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\CustomerDocument;
use App\Models\User;
use App\Services\DocumentRetentionService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(fn () => $this->seed(RoleAndPermissionSeeder::class));

it('removes expired document files and soft-deletes their records', function () {
    Storage::fake('public');
    $customer = User::factory()->create();
    Storage::disk('public')->put('customer-documents/test.jpg', 'test');
    $document = CustomerDocument::create(['user_id' => $customer->id, 'document_type' => CustomerDocument::PROOF_OF_BILLING,
        'status' => DocumentStatus::Approved, 'submitted_at' => now()->subMonths(14), 'reviewed_at' => now()->subMonths(13),
        'file_path' => 'customer-documents/test.jpg']);

    expect(app(DocumentRetentionService::class)->archiveExpired())->toBe(1);
    $this->assertSoftDeleted('customer_documents', ['id' => $document->id]);
    Storage::disk('public')->assertMissing('customer-documents/test.jpg');
    expect($document->files()->count())->toBe(0);
    expect($customer->fresh()->customerProfile->can_self_drive)->toBeFalse();
});

it('keeps expired documents while a self-drive booking is not terminal', function () {
    $customer = User::factory()->create();
    $vehicle = availableVehicle();
    $document = CustomerDocument::create(['user_id' => $customer->id, 'document_type' => CustomerDocument::DRIVERS_LICENSE,
        'status' => DocumentStatus::Pending, 'submitted_at' => now()->subMonths(13)]);
    Booking::create(['booking_code' => 'BK-RETAIN', 'user_id' => $customer->id, 'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::SelfDrive, 'rental_start_at' => now()->addDay(), 'rental_end_at' => now()->addDays(2),
        'pickup_location_type' => 'shop', 'pickup_location' => 'Garage', 'return_location' => 'Garage',
        'status' => BookingStatus::Confirmed, 'price_per_day' => 1000, 'duration_days' => 1]);

    expect(app(DocumentRetentionService::class)->archiveExpired())->toBe(0);
    expect($document->fresh())->not->toBeNull();
});

it('uses the recent verification decision when there is no rental', function () {
    $customer = User::factory()->create();
    $document = CustomerDocument::create(['user_id' => $customer->id, 'document_type' => CustomerDocument::DRIVERS_LICENSE,
        'status' => DocumentStatus::Approved, 'submitted_at' => now()->subMonths(14), 'reviewed_at' => now()->subMonths(2)]);

    expect(app(DocumentRetentionService::class)->archiveExpired())->toBe(0);
    expect($document->fresh())->not->toBeNull();
});

it('archives a multi-image document and retries any failed file deletion', function () {
    $customer = User::factory()->create();
    $document = CustomerDocument::create(['user_id' => $customer->id, 'document_type' => CustomerDocument::PROOF_OF_BILLING,
        'status' => DocumentStatus::Approved, 'submitted_at' => now()->subMonths(14), 'reviewed_at' => now()->subMonths(13),
        'front_file_path' => 'customer-documents/front.jpg', 'back_file_path' => 'customer-documents/back.jpg']);
    $files = ['customer-documents/front.jpg' => true, 'customer-documents/back.jpg' => true];
    $failBack = true;
    $disk = Mockery::mock(Filesystem::class);
    $disk->shouldReceive('exists')->andReturnUsing(function ($path) use (&$files) {
        return $files[$path];
    });
    $disk->shouldReceive('delete')->andReturnUsing(function ($path) use (&$files, &$failBack) {
        if ($path === 'customer-documents/back.jpg' && $failBack) {
            return false;
        }
        $files[$path] = false;

        return true;
    });
    Storage::shouldReceive('disk')->with('public')->andReturn($disk);

    expect(app(DocumentRetentionService::class)->archiveExpired())->toBe(1);
    $this->assertSoftDeleted('customer_documents', ['id' => $document->id]);
    expect($files['customer-documents/front.jpg'])->toBeFalse()
        ->and($files['customer-documents/back.jpg'])->toBeTrue();
    $this->assertDatabaseCount('document_retention_file_deletions', 1);

    $failBack = false;
    expect(app(DocumentRetentionService::class)->archiveExpired())->toBe(0);
    expect($files['customer-documents/back.jpg'])->toBeFalse();
    $this->assertDatabaseCount('document_retention_file_deletions', 0);
});

it('does not delete a queued file that is used by an active document', function () {
    Storage::fake('public');
    $customer = User::factory()->create();
    Storage::disk('public')->put('customer-documents/active.jpg', 'test');
    CustomerDocument::create(['user_id' => $customer->id, 'document_type' => CustomerDocument::PROOF_OF_BILLING,
        'status' => DocumentStatus::Pending, 'submitted_at' => now(), 'file_path' => 'customer-documents/active.jpg']);
    DB::table('document_retention_file_deletions')->insert(['user_id' => $customer->id,
        'file_path' => 'customer-documents/active.jpg', 'created_at' => now()]);

    app(DocumentRetentionService::class)->archiveExpired();

    Storage::disk('public')->assertExists('customer-documents/active.jpg');
    $this->assertDatabaseCount('document_retention_file_deletions', 0);
});

it('retains documents for twelve months after the last completed rental', function () {
    $customer = User::factory()->create();
    $vehicle = availableVehicle();
    $document = CustomerDocument::create(['user_id' => $customer->id, 'document_type' => CustomerDocument::DRIVERS_LICENSE,
        'status' => DocumentStatus::Approved, 'submitted_at' => now()->subMonths(16), 'reviewed_at' => now()->subMonths(15)]);
    $booking = Booking::create(['booking_code' => 'BK-RETAIN-COMPLETED', 'user_id' => $customer->id, 'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::SelfDrive, 'rental_start_at' => now()->subMonths(2), 'rental_end_at' => now()->subMonths(2)->addDay(),
        'pickup_location_type' => 'shop', 'pickup_location' => 'Garage', 'return_location' => 'Garage',
        'status' => BookingStatus::Completed, 'price_per_day' => 1000, 'duration_days' => 1]);
    $booking->events()->create(['event_type' => 'status_changed', 'new_status' => BookingStatus::Completed]);

    expect(app(DocumentRetentionService::class)->archiveExpired())->toBe(0);
    expect($document->fresh())->not->toBeNull();
});
