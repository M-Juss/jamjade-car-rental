<?php

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Enums\VehicleConditionUpdateReason;
use App\Enums\VehicleInspectionStatus;
use App\Enums\VehicleInspectionType;
use App\Models\Booking;
use App\Models\User;
use App\Models\VehicleInspection;
use App\Services\VehicleInspectionService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Storage::fake('local');
});

function completeVehiclePayload(array $conditionOverrides = []): array
{
    return [
        'name' => 'Toyota Vios XLE',
        'brand' => 'Toyota',
        'model' => 'Vios XLE',
        'plate_number' => 'INS-1234',
        'price_per_day' => 2500,
        'seats' => 5,
        'transmission' => 'Automatic',
        'fuel_type' => 'Gasoline',
        'color' => 'Pearl White',
        'description' => 'Compact sedan for city rentals.',
        'features' => ['Air Conditioning'],
        'images' => ['vehicles/sample-vios.jpg'],
        'initial_condition' => vehicleConditionPayload($conditionOverrides),
    ];
}

it('creates and finalizes an initial condition with a private personnel signature', function () {
    $manager = vehicleManagerUser();

    $response = $this->actingAs($manager)->postJson('/admin/vehicles', completeVehiclePayload([
        'markers' => [[
            'sequence_number' => 1,
            'panel' => 'right',
            'x_position' => 62.417,
            'y_position' => 39.210,
            'issue_type' => 'scratch',
            'description' => 'Small scratch near the rear passenger door.',
        ]],
    ]));

    $response->assertCreated()->assertJsonPath('data.hasCurrentCondition', true);

    $vehicleId = $response->json('data.id');
    $inspection = VehicleInspection::query()->where('vehicle_id', $vehicleId)->firstOrFail();

    expect($inspection->status)->toBe(VehicleInspectionStatus::Finalized)
        ->and($inspection->items)->toHaveCount(27)
        ->and($inspection->markers)->toHaveCount(1)
        ->and($inspection->signatures)->toHaveCount(1)
        ->and($inspection->signatures->first()->user_id)->toBe($manager->id)
        ->and($inspection->signatures->first()->signature_path)->toStartWith('vehicle-inspection-signatures/');

    expect($inspection->vehicle->current_condition_inspection_id)->toBe($inspection->id);
    Storage::disk('local')->assertExists($inspection->signatures->first()->signature_path);
});

it('rejects users without vehicle management permission', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/admin/vehicles', completeVehiclePayload())
        ->assertForbidden();
});

it('validates marker panels coordinates issue types and sequential numbering', function () {
    $payload = completeVehiclePayload([
        'markers' => [[
            'sequence_number' => 2,
            'panel' => 'roof',
            'x_position' => 100.001,
            'y_position' => -0.001,
            'issue_type' => 'rust',
            'description' => 'Invalid marker.',
        ]],
    ]);

    $this->actingAs(vehicleManagerUser())
        ->postJson('/admin/vehicles', $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors([
            'initial_condition.markers',
            'initial_condition.markers.0.panel',
            'initial_condition.markers.0.x_position',
            'initial_condition.markers.0.y_position',
            'initial_condition.markers.0.issue_type',
        ]);
});

it('requires every checklist item and a signature', function () {
    $payload = completeVehiclePayload();
    unset(
        $payload['initial_condition']['checklist']['exterior']['carwash'],
        $payload['initial_condition']['signature_data']
    );

    $this->actingAs(vehicleManagerUser())
        ->postJson('/admin/vehicles', $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors([
            'initial_condition.checklist.exterior',
            'initial_condition.checklist.exterior.carwash',
            'initial_condition.signature_data',
        ]);
});

it('configures an initial condition for a legacy vehicle only once', function () {
    $vehicle = availableVehicle();
    $manager = vehicleManagerUser();

    $this->actingAs($manager)
        ->postJson("/admin/vehicles/{$vehicle->id}/initial-condition", [
            'condition' => vehicleConditionPayload(),
        ])
        ->assertCreated()
        ->assertJsonPath('data.type', 'initial')
        ->assertJsonPath('data.status', 'finalized');

    $this->actingAs($manager)
        ->postJson("/admin/vehicles/{$vehicle->id}/initial-condition", [
            'condition' => vehicleConditionPayload(),
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('condition');

    expect($vehicle->inspections()->count())->toBe(1)
        ->and($vehicle->fresh()->current_condition_inspection_id)->not->toBeNull();
});

it('finalizes a standalone condition update and preserves the previous snapshot', function () {
    $vehicle = availableVehicle();
    $manager = vehicleManagerUser();
    $marker = [
        'sequence_number' => 1,
        'panel' => 'right',
        'x_position' => 62.417,
        'y_position' => 39.210,
        'issue_type' => 'scratch',
        'description' => 'Small scratch near the rear passenger door.',
    ];

    $initialId = $this->actingAs($manager)
        ->postJson("/admin/vehicles/{$vehicle->id}/initial-condition", [
            'condition' => vehicleConditionPayload(['markers' => [$marker]]),
        ])
        ->assertCreated()
        ->json('data.id');

    $initial = VehicleInspection::query()->findOrFail($initialId);
    $initialSignaturePath = $initial->signatures()->firstOrFail()->signature_path;

    $response = $this->actingAs($manager)
        ->postJson("/admin/vehicles/{$vehicle->id}/condition-updates", [
            'reason' => VehicleConditionUpdateReason::MaintenanceCompleted->value,
            'notes' => 'Scheduled service completed.',
            'condition' => vehicleConditionPayload([
                'odometer' => 1425,
                'fuel_level' => 8,
                'comments' => 'Service complete and vehicle rechecked.',
                'checklist' => ['equipment' => ['four_tools' => false]],
                'markers' => [$marker],
            ]),
        ])
        ->assertCreated()
        ->assertJsonPath('data.type', VehicleInspectionType::ConditionUpdate->value)
        ->assertJsonPath('data.typeLabel', 'Condition Update')
        ->assertJsonPath('data.conditionUpdateReason', VehicleConditionUpdateReason::MaintenanceCompleted->value)
        ->assertJsonPath('data.conditionUpdateReasonLabel', 'Maintenance Completed')
        ->assertJsonPath('data.conditionUpdateNotes', 'Scheduled service completed.')
        ->assertJsonPath('data.basedOnInspectionId', (string) $initialId)
        ->assertJsonPath('data.booking', null)
        ->assertJsonPath('data.odometer', 1425)
        ->assertJsonPath('data.fuelLevel', 8);

    $updateId = $response->json('data.id');
    $updated = VehicleInspection::query()->findOrFail($updateId);

    expect($vehicle->fresh()->current_condition_inspection_id)->toBe($updated->id)
        ->and($vehicle->inspections()->count())->toBe(2)
        ->and($updated->status)->toBe(VehicleInspectionStatus::Finalized)
        ->and($updated->booking_id)->toBeNull()
        ->and($updated->signatures()->count())->toBe(1)
        ->and($updated->signatures()->firstOrFail()->signature_path)->not->toBe($initialSignaturePath)
        ->and($updated->items()->where('item_key', 'four_tools')->value('value'))->toBeFalse()
        ->and($updated->markers()->firstOrFail()->id)->not->toBe($initial->markers()->firstOrFail()->id)
        ->and($updated->markers()->firstOrFail()->description)->toBe($marker['description'])
        ->and($initial->fresh()->odometer)->toBe(1250)
        ->and($initial->fresh()->status)->toBe(VehicleInspectionStatus::Finalized)
        ->and($initial->items()->where('item_key', 'four_tools')->value('value'))->toBeTrue();

    expect(fn () => $updated->update(['comments' => 'Attempted rewrite.']))
        ->toThrow(LogicException::class)
        ->and(fn () => $updated->delete())
        ->toThrow(LogicException::class);

    $this->assertDatabaseHas('activity_log', [
        'event' => 'vehicle_condition_update_finalized',
        'subject_type' => VehicleInspection::class,
        'subject_id' => $updated->id,
    ]);
    $this->assertDatabaseHas('activity_log', [
        'event' => 'current_vehicle_condition_changed',
        'subject_type' => $vehicle::class,
        'subject_id' => $vehicle->id,
    ]);

    $this->actingAs($manager)
        ->getJson("/admin/vehicles/{$vehicle->id}/inspections")
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.id', (string) $updateId)
        ->assertJsonPath('data.1.id', (string) $initialId);
});

it('validates condition update reasons notes and odometer corrections', function () {
    $vehicle = availableVehicle();
    $manager = vehicleManagerUser();

    $this->actingAs($manager)
        ->postJson("/admin/vehicles/{$vehicle->id}/initial-condition", [
            'condition' => vehicleConditionPayload(),
        ])
        ->assertCreated();

    $this->actingAs($manager)
        ->postJson("/admin/vehicles/{$vehicle->id}/condition-updates", [
            'condition' => vehicleConditionPayload(['signature_data' => '']),
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['reason', 'condition.signature_data']);

    $this->actingAs($manager)
        ->postJson("/admin/vehicles/{$vehicle->id}/condition-updates", [
            'reason' => 'uncontrolled_reason',
            'condition' => vehicleConditionPayload(),
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('reason');

    $invalidStructure = vehicleConditionPayload();
    unset($invalidStructure['checklist']['exterior']['carwash']);

    $this->actingAs($manager)
        ->postJson("/admin/vehicles/{$vehicle->id}/condition-updates", [
            'reason' => VehicleConditionUpdateReason::IssueDiscovered->value,
            'condition' => $invalidStructure,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors([
            'condition.checklist.exterior',
            'condition.checklist.exterior.carwash',
        ]);

    $this->actingAs($manager)
        ->postJson("/admin/vehicles/{$vehicle->id}/condition-updates", [
            'reason' => VehicleConditionUpdateReason::Other->value,
            'condition' => vehicleConditionPayload(),
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('notes');

    $this->actingAs($manager)
        ->postJson("/admin/vehicles/{$vehicle->id}/condition-updates", [
            'reason' => VehicleConditionUpdateReason::RepairCompleted->value,
            'condition' => vehicleConditionPayload(['odometer' => 1200]),
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('condition.odometer');

    $this->actingAs($manager)
        ->postJson("/admin/vehicles/{$vehicle->id}/condition-updates", [
            'reason' => VehicleConditionUpdateReason::CorrectionReinspection->value,
            'condition' => vehicleConditionPayload(['odometer' => 1200]),
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('notes');

    $this->actingAs($manager)
        ->postJson("/admin/vehicles/{$vehicle->id}/condition-updates", [
            'reason' => VehicleConditionUpdateReason::CorrectionReinspection->value,
            'notes' => 'The previous reading was entered incorrectly; dashboard rechecked.',
            'condition' => vehicleConditionPayload(['odometer' => 1200]),
        ])
        ->assertCreated()
        ->assertJsonPath('data.odometer', 1200);
});

it('blocks current condition updates during an ongoing rental', function () {
    $vehicle = availableVehicle();
    $manager = vehicleManagerUser();

    $this->actingAs($manager)
        ->postJson("/admin/vehicles/{$vehicle->id}/initial-condition", [
            'condition' => vehicleConditionPayload(),
        ])
        ->assertCreated();

    Booking::create([
        'booking_code' => 'JJ-ONGOING-001',
        'user_id' => customerUser()->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->subDay(),
        'rental_end_at' => now()->addDay(),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Rent A Car Services',
        'return_location' => 'Jamjade Rent A Car Services',
        'driver_option' => RentalType::SelfDrive->value,
        'status' => BookingStatus::Ongoing,
        'payment_status' => PaymentStatus::Paid,
        'price_per_day' => 3500,
        'duration_days' => 2,
        'subtotal' => 7000,
        'total_amount' => 7000,
    ]);

    $this->actingAs($manager)
        ->getJson("/admin/vehicles/{$vehicle->id}")
        ->assertOk()
        ->assertJsonPath('data.hasOngoingRental', true)
        ->assertJsonPath('data.canUpdateCurrentCondition', false);

    $this->actingAs($manager)
        ->postJson("/admin/vehicles/{$vehicle->id}/condition-updates", [
            'reason' => VehicleConditionUpdateReason::CompanyUse->value,
            'condition' => vehicleConditionPayload(['odometer' => 1300]),
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('condition');

    expect($vehicle->inspections()->count())->toBe(1);
});

it('requires a current snapshot and vehicle management permission for condition updates', function () {
    $vehicle = availableVehicle();
    $manager = vehicleManagerUser();

    $this->actingAs($manager)
        ->postJson("/admin/vehicles/{$vehicle->id}/condition-updates", [
            'reason' => VehicleConditionUpdateReason::IssueDiscovered->value,
            'condition' => vehicleConditionPayload(),
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('condition');

    $this->actingAs(User::factory()->create())
        ->postJson("/admin/vehicles/{$vehicle->id}/condition-updates", [
            'reason' => VehicleConditionUpdateReason::IssueDiscovered->value,
            'condition' => vehicleConditionPayload(),
        ])
        ->assertForbidden();
});

it('rolls back a failed condition update and removes only its newly stored signature', function () {
    $vehicle = availableVehicle();
    $manager = vehicleManagerUser();

    $this->actingAs($manager)
        ->postJson("/admin/vehicles/{$vehicle->id}/initial-condition", [
            'condition' => vehicleConditionPayload(),
        ])
        ->assertCreated();

    $originalInspectionId = $vehicle->fresh()->current_condition_inspection_id;
    $originalFiles = Storage::disk('local')->allFiles('vehicle-inspection-signatures');
    $invalidCondition = vehicleConditionPayload([
        'markers' => [
            [
                'sequence_number' => 1,
                'panel' => 'front',
                'x_position' => 10,
                'y_position' => 10,
                'issue_type' => 'scratch',
                'description' => 'First marker.',
            ],
            [
                'sequence_number' => 1,
                'panel' => 'rear',
                'x_position' => 20,
                'y_position' => 20,
                'issue_type' => 'dent',
                'description' => 'Duplicate sequence forces persistence failure.',
            ],
        ],
    ]);

    expect(fn () => app(VehicleInspectionService::class)->updateCurrentCondition(
        $vehicle,
        $invalidCondition,
        VehicleConditionUpdateReason::IssueDiscovered->value,
        null,
        $manager
    ))->toThrow(QueryException::class);

    expect($vehicle->fresh()->current_condition_inspection_id)->toBe($originalInspectionId)
        ->and($vehicle->inspections()->count())->toBe(1)
        ->and(Storage::disk('local')->allFiles('vehicle-inspection-signatures'))->toBe($originalFiles);
});

it('retrieves current condition history and a vehicle-scoped inspection', function () {
    $vehicle = availableVehicle();
    $otherVehicle = availableVehicle(['name' => 'Other Vehicle']);
    $manager = vehicleManagerUser();

    $inspectionId = $this->actingAs($manager)
        ->postJson("/admin/vehicles/{$vehicle->id}/initial-condition", [
            'condition' => vehicleConditionPayload(),
        ])
        ->json('data.id');

    $this->actingAs($manager)
        ->getJson("/admin/vehicles/{$vehicle->id}/current-condition")
        ->assertOk()
        ->assertJsonPath('data.id', $inspectionId)
        ->assertJsonMissingPath('data.signatures.0.signaturePath');

    $this->actingAs($manager)
        ->getJson("/admin/vehicles/{$vehicle->id}/inspections")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $inspectionId);

    $this->actingAs($manager)
        ->getJson("/admin/vehicles/{$otherVehicle->id}/inspections/{$inspectionId}")
        ->assertNotFound();
});

it('keeps inspection data out of the public mobile vehicle resource', function () {
    $vehicle = availableVehicle();
    $manager = vehicleManagerUser();

    $this->actingAs($manager)
        ->postJson("/admin/vehicles/{$vehicle->id}/initial-condition", [
            'condition' => vehicleConditionPayload(),
        ])
        ->assertCreated();

    $this->actingAs($manager)
        ->postJson("/admin/vehicles/{$vehicle->id}/condition-updates", [
            'reason' => VehicleConditionUpdateReason::CompanyUse->value,
            'notes' => 'Company errand completed.',
            'condition' => vehicleConditionPayload(['odometer' => 1325]),
        ])
        ->assertCreated();

    $response = $this->getJson("/api/mobile/vehicles/{$vehicle->id}")
        ->assertOk();

    foreach (['hasCurrentCondition', 'currentCondition', 'inspections', 'checklist', 'markers', 'comments', 'signatures', 'conditionUpdateReason', 'conditionUpdateNotes', 'basedOnInspectionId'] as $key) {
        $response->assertJsonMissingPath("data.{$key}");
    }
});

it('rolls back vehicle creation and cleans files when inspection persistence fails', function () {
    Storage::fake('public');
    $manager = vehicleManagerUser();
    $inspectionService = Mockery::mock(VehicleInspectionService::class);
    $inspectionService->shouldReceive('storePersonnelSignature')
        ->once()
        ->andReturn('vehicle-inspection-signatures/test/signature.png');
    $inspectionService->shouldReceive('createInitial')
        ->once()
        ->andThrow(new RuntimeException('Forced persistence failure.'));
    $inspectionService->shouldReceive('deleteSignature')
        ->once()
        ->with('vehicle-inspection-signatures/test/signature.png');
    app()->instance(VehicleInspectionService::class, $inspectionService);

    $payload = completeVehiclePayload();
    $payload['images'] = [UploadedFile::fake()->image('vehicle.png')];

    $this->actingAs($manager)->post('/admin/vehicles', $payload)->assertServerError();

    $this->assertDatabaseMissing('vehicles', ['name' => $payload['name']]);
    expect(Storage::disk('public')->allFiles('vehicles'))->toBe([]);
});
