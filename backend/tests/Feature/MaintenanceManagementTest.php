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
use App\Support\MaintenanceDueCalculator;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    $this->actor = User::factory()->create();
    $this->actor->assignRole(UserRole::Owner->value);
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
        ->assertCreated()->assertJsonPath('data.dueStatus', MaintenanceDueStatus::DueSoon->value);

    $customer = User::factory()->create();
    $customer->assignRole(UserRole::Customer->value);
    $this->actingAs($customer)->postJson('/admin/maintenance-plans', maintenancePlanData($this->vehicle))->assertForbidden();

    $this->actingAs($this->actor)->postJson('/admin/maintenance-plans', maintenancePlanData($this->vehicle, [
        'trigger_type' => 'both', 'interval_days' => null, 'next_due_date' => null,
    ]))->assertUnprocessable()->assertJsonValidationErrors(['interval_days', 'next_due_date']);
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
