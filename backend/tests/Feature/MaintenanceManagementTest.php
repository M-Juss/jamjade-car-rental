<?php

use App\Enums\BookingStatus;
use App\Enums\MaintenanceDueStatus;
use App\Enums\MaintenanceRecordStatus;
use App\Enums\UserRole;
use App\Enums\VehicleInspectionStatus;
use App\Enums\VehicleInspectionType;
use App\Enums\VehicleStatus;
use App\Models\Booking;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleInspection;
use App\Models\VehicleMaintenancePlan;
use App\Models\VehicleMaintenanceRecord;
use App\Services\MaintenanceService;
use App\Services\VehicleAvailabilityService;
use App\Services\VehicleInspectionService;
use App\Support\MaintenanceDueCalculator;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Storage::fake('local');
    $this->actor = User::factory()->create();
    $this->actor->assignRole(UserRole::Admin->value);
    $this->vehicle = Vehicle::factory()->create(['status' => VehicleStatus::Available]);
    $inspection = VehicleInspection::factory()->create([
        'vehicle_id' => $this->vehicle->id,
        'type' => VehicleInspectionType::Initial,
        'status' => VehicleInspectionStatus::Finalized,
        'odometer' => 10_000,
        'finalized_at' => now(),
    ]);
    $this->vehicle->update(['current_condition_inspection_id' => $inspection->id]);
});

function maintenancePlanData(Vehicle $vehicle, array $overrides = []): array
{
    return array_merge([
        'vehicle_id' => $vehicle->id,
        'name' => 'Oil Change',
        'category' => 'preventive',
        'trigger_type' => 'mileage',
        'interval_km' => 5000,
        'next_due_odometer' => 10_500,
    ], $overrides);
}

function maintenanceScheduleData(Vehicle $vehicle, array $overrides = []): array
{
    return array_merge([
        'vehicle_id' => $vehicle->id,
        'title' => 'Brake inspection',
        'category' => 'preventive',
        'scheduled_start' => now()->addDays(3)->startOfHour(),
        'scheduled_end' => now()->addDays(3)->addHours(4)->startOfHour(),
    ], $overrides);
}

function blockingBooking(Vehicle $vehicle, User $user, mixed $start, mixed $end): Booking
{
    return Booking::create([
        'booking_code' => 'BK-'.fake()->unique()->numerify('######'), 'user_id' => $user->id, 'vehicle_id' => $vehicle->id,
        'rental_type' => 'self_drive', 'rental_start_at' => $start, 'rental_end_at' => $end,
        'pickup_location_type' => 'shop', 'pickup_location' => 'Jamjade', 'return_location' => 'Jamjade',
        'driver_option' => 'self_drive', 'status' => BookingStatus::Confirmed, 'payment_status' => 'partial',
        'price_per_day' => 2000, 'duration_days' => 1, 'subtotal' => 2000, 'total_amount' => 2000,
    ]);
}

it('authorizes and validates maintenance plan creation', function () {
    $this->actingAs($this->actor)->postJson('/admin/maintenance-plans', maintenancePlanData($this->vehicle))
        ->assertCreated()
        ->assertJsonPath('data.currentOdometer', 10_000)
        ->assertJsonPath('data.nextDueOdometer', 15_000)
        ->assertJsonPath('data.dueStatus', MaintenanceDueStatus::Upcoming->value);

    $customer = User::factory()->create();
    $customer->assignRole(UserRole::Customer->value);
    $this->actingAs($customer)->postJson('/admin/maintenance-plans', maintenancePlanData($this->vehicle))->assertForbidden();

    $this->actingAs($this->actor)->postJson('/admin/maintenance-plans', maintenancePlanData($this->vehicle, [
        'trigger_type' => 'both', 'interval_days' => null, 'next_due_date' => null,
    ]))->assertUnprocessable()->assertJsonValidationErrors(['interval_days']);
});

it('allows a maintenance-only admin to load module vehicles without vehicle-management access', function () {
    $role = Role::create(['name' => 'maintenance_coordinator', 'guard_name' => 'web']);
    $role->givePermissionTo('manage maintenance');
    $coordinator = User::factory()->create();
    $coordinator->assignRole($role);

    $this->actingAs($coordinator)->getJson('/admin/maintenance/vehicles')
        ->assertOk()->assertJsonPath('data.0.id', (string) $this->vehicle->id);
    $this->actingAs($coordinator)->getJson('/admin/vehicles')->assertForbidden();
});

it('derives due status using the earliest mileage or date trigger', function () {
    $plan = VehicleMaintenancePlan::create([...maintenancePlanData($this->vehicle), 'trigger_type' => 'both',
        'interval_days' => 180, 'next_due_odometer' => 11_000, 'next_due_date' => today()->subDay(), 'created_by' => $this->actor->id]);

    expect(app(MaintenanceDueCalculator::class)->calculate($plan, 10_000)['status'])->toBe(MaintenanceDueStatus::Overdue);
});

it('keeps informational plan due states from blocking booking availability', function () {
    VehicleMaintenancePlan::create([...maintenancePlanData($this->vehicle, ['next_due_odometer' => 9000]), 'created_by' => $this->actor->id]);

    app(VehicleAvailabilityService::class)->assertBookingIntervalAvailable(
        $this->vehicle->id, now()->addDay(), now()->addDays(2)
    );

    expect(true)->toBeTrue();
});

it('rejects maintenance schedules that conflict with real blocking bookings', function () {
    $data = maintenanceScheduleData($this->vehicle);
    blockingBooking($this->vehicle, $this->actor, $data['scheduled_start'], $data['scheduled_end']);

    expect(fn () => app(MaintenanceService::class)->schedule($data, $this->actor))
        ->toThrow(ValidationException::class, 'conflicts with an existing booking');
    expect(VehicleMaintenanceRecord::count())->toBe(0);
});

it('blocks only manually scheduled intervals and cancellation releases them', function () {
    $data = maintenanceScheduleData($this->vehicle);
    $record = app(MaintenanceService::class)->schedule($data, $this->actor);

    expect($this->vehicle->fresh()->status)->toBe(VehicleStatus::Available)
        ->and(fn () => app(VehicleAvailabilityService::class)->assertBookingIntervalAvailable(
            $this->vehicle->id, $data['scheduled_start'], $data['scheduled_end']
        ))->toThrow(ValidationException::class);

    app(MaintenanceService::class)->cancel($record, $this->actor);
    app(VehicleAvailabilityService::class)->assertBookingIntervalAvailable($this->vehicle->id, $data['scheduled_start'], $data['scheduled_end']);
    expect($record->fresh()->status)->toBe(MaintenanceRecordStatus::Cancelled);
});

it('starts and completes maintenance with server timestamps costs next targets and early release', function () {
    $plan = VehicleMaintenancePlan::create([...maintenancePlanData($this->vehicle), 'created_by' => $this->actor->id]);
    $data = maintenanceScheduleData($this->vehicle, ['maintenance_plan_id' => $plan->id, 'title' => null, 'category' => null]);
    $record = app(MaintenanceService::class)->schedule($data, $this->actor);
    $record = app(MaintenanceService::class)->start($record, $this->actor);

    expect($record->actual_started_at)->not->toBeNull()
        ->and($record->odometer_at_start)->toBe(10_000)
        ->and($this->vehicle->fresh()->status)->toBe(VehicleStatus::Maintenance);

    $record = app(MaintenanceService::class)->complete($record, [
        'odometer_at_completion' => 10_020, 'work_performed' => 'Changed oil and filter.',
        'labor_cost' => 500, 'parts_cost' => 1200.50, 'other_cost' => 50,
    ], $this->actor);

    expect($record->status)->toBe(MaintenanceRecordStatus::Completed)
        ->and((float) $record->total_cost)->toBe(1750.50)
        ->and($this->vehicle->fresh()->status)->toBe(VehicleStatus::Available)
        ->and($plan->fresh()->next_due_odometer)->toBe(15_020);

    app(VehicleAvailabilityService::class)->assertBookingIntervalAvailable(
        $this->vehicle->id, $record->completed_at->copy()->addMinute(), $record->scheduled_end
    );
});

it('keeps overrun maintenance unavailable until explicit completion', function () {
    $record = VehicleMaintenanceRecord::create([
        ...maintenanceScheduleData($this->vehicle, ['scheduled_start' => now()->subDay(), 'scheduled_end' => now()->subHour()]),
        'status' => MaintenanceRecordStatus::InProgress, 'actual_started_at' => now()->subDay(), 'created_by' => $this->actor->id,
    ]);
    $this->vehicle->update(['status' => VehicleStatus::Maintenance]);

    expect(fn () => app(VehicleAvailabilityService::class)->assertBookingIntervalAvailable(
        $this->vehicle->id, now()->addHour(), now()->addHours(2)
    ))->toThrow(ValidationException::class);

    expect(fn () => app(VehicleAvailabilityService::class)->assertMaintenanceIntervalAvailable(
        $this->vehicle->id, now()->addDay(), now()->addDays(2)
    ))->toThrow(ValidationException::class);

    app(MaintenanceService::class)->complete($record, [
        'odometer_at_completion' => 10_100, 'work_performed' => 'Completed delayed work.',
    ], $this->actor);
    app(VehicleAvailabilityService::class)->assertBookingIntervalAvailable($this->vehicle->id, now()->addHour(), now()->addHours(2));
});

it('does not leak maintenance internals through the mobile vehicle resource', function () {
    VehicleMaintenanceRecord::create([...maintenanceScheduleData($this->vehicle), 'status' => MaintenanceRecordStatus::Scheduled,
        'service_provider' => 'Private Shop', 'notes' => 'Internal note', 'labor_cost' => 500, 'created_by' => $this->actor->id]);

    $response = $this->getJson("/api/mobile/vehicles/{$this->vehicle->id}")->assertOk();
    $json = json_encode($response->json('data'));
    expect($json)->not->toContain('Private Shop')->not->toContain('Internal note')->not->toContain('laborCost');
});

it('requires authoritative current condition mileage and calculates every initial plan target', function () {
    $withoutCondition = Vehicle::factory()->create(['status' => VehicleStatus::Available]);

    $this->actingAs($this->actor)->postJson('/admin/maintenance-plans', maintenancePlanData($withoutCondition))
        ->assertUnprocessable()->assertJsonValidationErrors('vehicle_id');

    $datePlan = $this->actingAs($this->actor)->postJson('/admin/maintenance-plans', maintenancePlanData($this->vehicle, [
        'trigger_type' => 'date', 'interval_km' => null, 'interval_days' => 30,
    ]))->assertCreated();
    $datePlan->assertJsonPath('data.nextDueDate', today()->addDays(30)->toDateString());

    $bothPlan = $this->actingAs($this->actor)->postJson('/admin/maintenance-plans', maintenancePlanData($this->vehicle, [
        'name' => 'Combined service', 'trigger_type' => 'both', 'interval_days' => 90,
    ]))->assertCreated();
    $bothPlan->assertJsonPath('data.nextDueOdometer', 15_000)
        ->assertJsonPath('data.nextDueDate', today()->addDays(90)->toDateString());
});

it('uses 25 percent mileage remaining and seven days remaining for due soon', function () {
    $mileagePlan = VehicleMaintenancePlan::create([
        ...maintenancePlanData($this->vehicle, ['next_due_odometer' => 15_000]),
        'created_by' => $this->actor->id,
    ]);
    $calculator = app(MaintenanceDueCalculator::class);

    expect($calculator->calculate($mileagePlan, 13_749)['status'])->toBe(MaintenanceDueStatus::Upcoming)
        ->and($calculator->calculate($mileagePlan, 13_750)['status'])->toBe(MaintenanceDueStatus::DueSoon)
        ->and($calculator->calculate($mileagePlan, 15_000)['status'])->toBe(MaintenanceDueStatus::Due)
        ->and($calculator->calculate($mileagePlan, 15_001)['status'])->toBe(MaintenanceDueStatus::Overdue);

    $datePlan = VehicleMaintenancePlan::create([
        ...maintenancePlanData($this->vehicle, [
            'name' => 'Annual check', 'trigger_type' => 'date', 'interval_km' => null,
            'interval_days' => 30, 'next_due_odometer' => null, 'next_due_date' => today()->addDays(7),
        ]),
        'created_by' => $this->actor->id,
    ]);
    expect($calculator->calculate($datePlan, 10_000)['status'])->toBe(MaintenanceDueStatus::DueSoon);
});

it('recalculates edited targets from the preserved cycle baseline without rewriting history', function () {
    $plan = app(MaintenanceService::class)->createPlan(maintenancePlanData($this->vehicle), $this->actor);
    $history = VehicleMaintenanceRecord::create([
        ...maintenanceScheduleData($this->vehicle),
        'maintenance_plan_id' => $plan->id,
        'status' => MaintenanceRecordStatus::Completed,
        'completed_at' => now()->subDay(),
        'work_performed' => 'Previous evidence',
        'created_by' => $this->actor->id,
    ]);
    $historyBefore = [
        'title' => $history->title,
        'scheduled_start' => $history->scheduled_start->toISOString(),
        'scheduled_end' => $history->scheduled_end->toISOString(),
        'completed_at' => $history->completed_at->toISOString(),
    ];

    $newCondition = VehicleInspection::factory()->create([
        'vehicle_id' => $this->vehicle->id,
        'type' => VehicleInspectionType::ConditionUpdate,
        'status' => VehicleInspectionStatus::Finalized,
        'odometer' => 12_000,
        'finalized_at' => now(),
    ]);
    $this->vehicle->update(['current_condition_inspection_id' => $newCondition->id]);

    $updated = app(MaintenanceService::class)->updatePlan($plan, maintenancePlanData($this->vehicle, [
        'interval_km' => 6000,
    ]), $this->actor);

    expect($updated->baseline_odometer)->toBe(10_000)
        ->and($updated->next_due_odometer)->toBe(16_000)
        ->and([
            'title' => $history->fresh()->title,
            'scheduled_start' => $history->fresh()->scheduled_start->toISOString(),
            'scheduled_end' => $history->fresh()->scheduled_end->toISOString(),
            'completed_at' => $history->fresh()->completed_at->toISOString(),
        ])->toBe($historyBefore);
});

it('deletes unused plans archives plans with history and blocks deletion with active work', function () {
    $unused = VehicleMaintenancePlan::create([...maintenancePlanData($this->vehicle), 'created_by' => $this->actor->id]);
    $result = app(MaintenanceService::class)->deletePlan($unused, $this->actor);
    expect($result)->toBe(['deleted' => true, 'archived' => false])
        ->and(VehicleMaintenancePlan::find($unused->id))->toBeNull();

    $historical = VehicleMaintenancePlan::create([...maintenancePlanData($this->vehicle), 'name' => 'Historical', 'created_by' => $this->actor->id]);
    VehicleMaintenanceRecord::create([
        ...maintenanceScheduleData($this->vehicle), 'maintenance_plan_id' => $historical->id,
        'status' => MaintenanceRecordStatus::Completed, 'completed_at' => now(), 'created_by' => $this->actor->id,
    ]);
    $result = app(MaintenanceService::class)->deletePlan($historical, $this->actor);
    expect($result)->toBe(['deleted' => false, 'archived' => true])
        ->and($historical->fresh()->is_active)->toBeFalse()
        ->and($historical->records()->count())->toBe(1);

    $active = VehicleMaintenancePlan::create([...maintenancePlanData($this->vehicle), 'name' => 'Active', 'created_by' => $this->actor->id]);
    VehicleMaintenanceRecord::create([
        ...maintenanceScheduleData($this->vehicle, ['scheduled_start' => now()->addDays(8), 'scheduled_end' => now()->addDays(9)]),
        'maintenance_plan_id' => $active->id, 'status' => MaintenanceRecordStatus::Scheduled, 'created_by' => $this->actor->id,
    ]);
    expect(fn () => app(MaintenanceService::class)->deletePlan($active, $this->actor))
        ->toThrow(ValidationException::class, 'Resolve the scheduled or in-progress maintenance');
});

it('prevents duplicate active maintenance for one plan cycle', function () {
    $plan = VehicleMaintenancePlan::create([...maintenancePlanData($this->vehicle), 'created_by' => $this->actor->id]);
    app(MaintenanceService::class)->schedule(maintenanceScheduleData($this->vehicle, [
        'maintenance_plan_id' => $plan->id, 'title' => null, 'category' => null,
    ]), $this->actor);

    expect(fn () => app(MaintenanceService::class)->schedule(maintenanceScheduleData($this->vehicle, [
        'maintenance_plan_id' => $plan->id,
        'title' => null,
        'category' => null,
        'scheduled_start' => now()->addDays(10),
        'scheduled_end' => now()->addDays(11),
    ]), $this->actor))->toThrow(ValidationException::class, 'already has scheduled or in-progress maintenance');
});

it('treats any booked or maintained calendar day as unavailable and rejects ranges crossing it', function () {
    $blockedDay = now()->addDays(5);
    blockingBooking($this->vehicle, $this->actor, $blockedDay->copy()->setTime(18, 0), $blockedDay->copy()->setTime(19, 0));

    expect(fn () => app(MaintenanceService::class)->schedule(maintenanceScheduleData($this->vehicle, [
        'scheduled_start' => $blockedDay->copy()->setTime(8, 0),
        'scheduled_end' => $blockedDay->copy()->setTime(10, 0),
    ]), $this->actor))->toThrow(ValidationException::class, 'conflicts with an existing booking');

    expect(fn () => app(MaintenanceService::class)->schedule(maintenanceScheduleData($this->vehicle, [
        'scheduled_start' => $blockedDay->copy()->subDay()->setTime(8, 0),
        'scheduled_end' => $blockedDay->copy()->addDay()->setTime(10, 0),
    ]), $this->actor))->toThrow(ValidationException::class, 'conflicts with an existing booking');
});

it('reschedules the same record releases the old block applies the new block and revalidates conflicts', function () {
    $record = app(MaintenanceService::class)->schedule(maintenanceScheduleData($this->vehicle), $this->actor);
    $oldStart = $record->scheduled_start->copy();
    $oldEnd = $record->scheduled_end->copy();
    $newStart = now()->addDays(8)->startOfHour();
    $newEnd = now()->addDays(8)->addHours(3)->startOfHour();

    $record = app(MaintenanceService::class)->reschedule($record, [
        'scheduled_start' => $newStart, 'scheduled_end' => $newEnd,
    ], $this->actor);
    app(VehicleAvailabilityService::class)->assertBookingIntervalAvailable($this->vehicle->id, $oldStart, $oldEnd);
    expect(fn () => app(VehicleAvailabilityService::class)->assertBookingIntervalAvailable(
        $this->vehicle->id, $newStart, $newEnd
    ))->toThrow(ValidationException::class);

    $conflictStart = now()->addDays(12)->startOfHour();
    $conflictEnd = $conflictStart->copy()->addHours(2);
    blockingBooking($this->vehicle, $this->actor, $conflictStart, $conflictEnd);
    expect(fn () => app(MaintenanceService::class)->reschedule($record, [
        'scheduled_start' => $conflictStart, 'scheduled_end' => $conflictEnd,
    ], $this->actor))->toThrow(ValidationException::class, 'conflicts with an existing booking');
    expect($record->fresh()->scheduled_start->equalTo($newStart))->toBeTrue();
});

it('preserves cancellation reason in readonly history and forbids cancel or reschedule after start', function () {
    $record = app(MaintenanceService::class)->schedule(maintenanceScheduleData($this->vehicle), $this->actor);
    $cancelled = app(MaintenanceService::class)->cancel($record, $this->actor, 'Shop became unavailable.');
    expect($cancelled->status)->toBe(MaintenanceRecordStatus::Cancelled)
        ->and($cancelled->cancellation_reason)->toBe('Shop became unavailable.')
        ->and($cancelled->cancelled_at)->not->toBeNull();

    $active = app(MaintenanceService::class)->schedule(maintenanceScheduleData($this->vehicle, [
        'scheduled_start' => now()->addDays(7), 'scheduled_end' => now()->addDays(7)->addHours(2),
    ]), $this->actor);
    $active = app(MaintenanceService::class)->start($active, $this->actor);
    expect(fn () => app(MaintenanceService::class)->cancel($active, $this->actor))
        ->toThrow(ValidationException::class)
        ->and(fn () => app(MaintenanceService::class)->reschedule($active, [
            'scheduled_start' => now()->addDays(9), 'scheduled_end' => now()->addDays(10),
        ], $this->actor))->toThrow(ValidationException::class);
});

it('requires mileage completion odometer but allows it to be omitted for custom work', function () {
    $plan = VehicleMaintenancePlan::create([...maintenancePlanData($this->vehicle), 'created_by' => $this->actor->id]);
    $planned = app(MaintenanceService::class)->schedule(maintenanceScheduleData($this->vehicle, [
        'maintenance_plan_id' => $plan->id, 'title' => null, 'category' => null,
    ]), $this->actor);
    $planned = app(MaintenanceService::class)->start($planned, $this->actor);
    $this->actingAs($this->actor)->postJson("/admin/maintenance/{$planned->id}/complete", [
        'work_performed' => 'Changed fluids.',
    ])->assertUnprocessable()->assertJsonValidationErrors('odometer_at_completion');

    app(MaintenanceService::class)->complete($planned, [
        'odometer_at_completion' => 10_050, 'work_performed' => 'Changed fluids.',
    ], $this->actor);

    $custom = app(MaintenanceService::class)->schedule(maintenanceScheduleData($this->vehicle, [
        'scheduled_start' => now()->addDays(9), 'scheduled_end' => now()->addDays(9)->addHours(2),
    ]), $this->actor);
    $custom = app(MaintenanceService::class)->start($custom, $this->actor);
    $custom = app(MaintenanceService::class)->complete($custom, [
        'work_performed' => 'Cleaned interior trim.', 'labor_cost' => 100, 'parts_cost' => 50, 'other_cost' => 25,
    ], $this->actor);
    expect($custom->status)->toBe(MaintenanceRecordStatus::Completed)
        ->and($custom->odometer_at_completion)->toBeNull()
        ->and((float) $custom->total_cost)->toBe(175.0);
});

it('gates body repair completion on a new finalized immutable condition update', function () {
    $record = app(MaintenanceService::class)->schedule(maintenanceScheduleData($this->vehicle, [
        'title' => 'Door repair', 'category' => 'body_repair',
    ]), $this->actor);
    $record = app(MaintenanceService::class)->start($record, $this->actor);
    $previousCondition = $this->vehicle->currentCondition;
    $previousUpdatedAt = $previousCondition->updated_at?->toISOString();

    $this->actingAs($this->actor)->postJson("/admin/maintenance/{$record->id}/complete", [
        'work_performed' => 'Repaired and repainted the door.',
        'condition_changed' => false,
    ])->assertUnprocessable()->assertJsonValidationErrors('condition_changed');

    $pending = app(MaintenanceService::class)->complete($record, [
        'work_performed' => 'Repaired and repainted the door.',
        'condition_changed' => true,
    ], $this->actor);
    expect($pending->status)->toBe(MaintenanceRecordStatus::InProgress)
        ->and($pending->condition_verification_required)->toBeTrue()
        ->and($this->vehicle->fresh()->status)->toBe(VehicleStatus::Maintenance);

    $response = $this->actingAs($this->actor)->postJson("/admin/maintenance/{$record->id}/completion-condition", [
        'reason' => 'repair_completed',
        'notes' => 'Verified after body repair.',
        'condition' => vehicleConditionPayload(['odometer' => 10_100, 'comments' => 'Door repair verified.']),
    ])->assertOk()->assertJsonPath('data.status', 'completed');
    $inspection = VehicleInspection::findOrFail($response->json('data.resultingConditionInspectionId'));
    $completed = $pending->fresh();

    expect($completed->status)->toBe(MaintenanceRecordStatus::Completed)
        ->and($completed->resulting_condition_inspection_id)->toBe($inspection->id)
        ->and($this->vehicle->fresh()->current_condition_inspection_id)->toBe($inspection->id)
        ->and($previousCondition->fresh()->odometer)->toBe(10_000)
        ->and($previousCondition->fresh()->status)->toBe(VehicleInspectionStatus::Finalized)
        ->and($previousCondition->fresh()->updated_at?->toISOString())->toBe($previousUpdatedAt)
        ->and($inspection->based_on_inspection_id)->toBe($previousCondition->id);
});

it('rolls back a finalized condition update when maintenance linking fails', function () {
    $previousConditionId = $this->vehicle->current_condition_inspection_id;
    $inspectionCount = VehicleInspection::count();

    expect(fn () => app(VehicleInspectionService::class)->updateCurrentCondition(
        $this->vehicle,
        vehicleConditionPayload(['odometer' => 10_100]),
        'maintenance_completed',
        'Verification should roll back.',
        $this->actor,
        fn () => throw new RuntimeException('Maintenance linking failed.')
    ))->toThrow(RuntimeException::class, 'Maintenance linking failed.');

    expect($this->vehicle->fresh()->current_condition_inspection_id)->toBe($previousConditionId)
        ->and(VehicleInspection::count())->toBe($inspectionCount)
        ->and(Storage::disk('local')->allFiles('vehicle-inspection-signatures'))->toBeEmpty();
});

it('requires the corrective or other condition decision and follows yes or no correctly', function () {
    $record = app(MaintenanceService::class)->schedule(maintenanceScheduleData($this->vehicle, [
        'title' => 'Electrical correction', 'category' => 'corrective',
    ]), $this->actor);
    $record = app(MaintenanceService::class)->start($record, $this->actor);

    $this->actingAs($this->actor)->postJson("/admin/maintenance/{$record->id}/complete", [
        'work_performed' => 'Replaced a faulty relay.',
    ])->assertUnprocessable()->assertJsonValidationErrors('condition_changed');

    $completed = app(MaintenanceService::class)->complete($record, [
        'work_performed' => 'Replaced a faulty relay.', 'condition_changed' => false,
    ], $this->actor);
    expect($completed->status)->toBe(MaintenanceRecordStatus::Completed)
        ->and($completed->condition_verification_required)->toBeFalse();

    $other = app(MaintenanceService::class)->schedule(maintenanceScheduleData($this->vehicle, [
        'title' => 'Accessory work', 'category' => 'other',
        'scheduled_start' => now()->addDays(10), 'scheduled_end' => now()->addDays(10)->addHours(2),
    ]), $this->actor);
    $other = app(MaintenanceService::class)->start($other, $this->actor);
    $other = app(MaintenanceService::class)->complete($other, [
        'work_performed' => 'Adjusted tracked equipment.', 'condition_changed' => true,
    ], $this->actor);
    expect($other->status)->toBe(MaintenanceRecordStatus::InProgress)
        ->and($other->condition_verification_required)->toBeTrue();
});

it('records lifecycle activity without exposing sensitive maintenance content', function () {
    $record = app(MaintenanceService::class)->schedule(maintenanceScheduleData($this->vehicle), $this->actor);
    app(MaintenanceService::class)->reschedule($record, [
        'scheduled_start' => now()->addDays(6), 'scheduled_end' => now()->addDays(6)->addHours(2),
    ], $this->actor);
    app(MaintenanceService::class)->cancel($record, $this->actor, 'Private cancellation detail');

    $events = DB::table('activity_log')->where('subject_type', VehicleMaintenanceRecord::class)
        ->pluck('event')->all();
    $properties = DB::table('activity_log')->where('subject_type', VehicleMaintenanceRecord::class)
        ->pluck('properties')->implode(' ');
    expect($events)->toContain('maintenance_scheduled', 'maintenance_rescheduled', 'maintenance_cancelled')
        ->and($properties)->not->toContain('Private cancellation detail');
});
