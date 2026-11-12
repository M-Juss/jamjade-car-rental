<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\MaintenanceCategory;
use App\Enums\MaintenanceRecordStatus;
use App\Enums\MaintenanceTriggerType;
use App\Enums\VehicleConditionUpdateReason;
use App\Enums\VehicleInspectionStatus;
use App\Enums\VehicleInspectionType;
use App\Enums\VehicleStatus;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleInspection;
use App\Models\VehicleMaintenancePlan;
use App\Models\VehicleMaintenanceRecord;
use App\Support\MaintenanceDueCalculator;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MaintenanceService
{
    public function __construct(
        private readonly VehicleAvailabilityService $availabilityService,
        private readonly VehicleOperationalStatusService $operationalStatusService
    ) {}

    public function paginate(array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        return VehicleMaintenanceRecord::query()->with($this->relations())
            ->when($filters['vehicle_id'] ?? null, fn ($query, $id) => $query->where('vehicle_id', $id))
            ->when($filters['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->when($filters['search'] ?? null, function ($query, string $search) {
                $query->where(fn ($query) => $query->where('title', 'like', "%{$search}%")
                    ->orWhereHas('vehicle', fn ($query) => $query->where('name', 'like', "%{$search}%")));
            })->latest('scheduled_start')->paginate($perPage);
    }

    public function summary(): array
    {
        $dueCounts = VehicleMaintenancePlan::query()->where('is_active', true)
            ->with('vehicle.currentCondition')->get()
            ->map(fn (VehicleMaintenancePlan $plan) => app(MaintenanceDueCalculator::class)
                ->calculate($plan, $plan->vehicle?->currentCondition?->odometer)['status']->value)
            ->countBy();

        return [
            'dueSoon' => $dueCounts->get('due_soon', 0),
            'overdue' => $dueCounts->get('overdue', 0),
            'scheduled' => VehicleMaintenanceRecord::where('status', MaintenanceRecordStatus::Scheduled)->count(),
            'inProgress' => VehicleMaintenanceRecord::where('status', MaintenanceRecordStatus::InProgress)->count(),
        ];
    }

    public function createPlan(array $data, User $actor): VehicleMaintenancePlan
    {
        return DB::transaction(function () use ($data, $actor) {
            $vehicle = Vehicle::query()->with('currentCondition')->lockForUpdate()->findOrFail($data['vehicle_id']);
            $trigger = MaintenanceTriggerType::from($data['trigger_type']);
            $baselineOdometer = $trigger->usesMileage() ? $vehicle->currentCondition?->odometer : null;
            if ($trigger->usesMileage() && $baselineOdometer === null) {
                throw ValidationException::withMessages([
                    'vehicle_id' => ['Set the vehicle Current Condition odometer before creating a mileage-based maintenance plan.'],
                ]);
            }

            $plan = VehicleMaintenancePlan::create([
                ...$this->normalizedPlanData($data, $trigger),
                'baseline_odometer' => $baselineOdometer,
                'baseline_date' => $trigger->usesDate() ? today()->toDateString() : null,
                'next_due_odometer' => $trigger->usesMileage()
                    ? $baselineOdometer + (int) $data['interval_km']
                    : null,
                'next_due_date' => $trigger->usesDate()
                    ? today()->addDays((int) $data['interval_days'])->toDateString()
                    : null,
                'created_by' => $actor->id,
                'is_active' => true,
            ]);

            activity()->causedBy($actor)->performedOn($plan)->event('maintenance_plan_created')
                ->withProperties(['vehicle_id' => $plan->vehicle_id])->log('Maintenance plan created.');

            return $this->loadPlan($plan);
        });
    }

    public function updatePlan(VehicleMaintenancePlan $plan, array $data, User $actor): VehicleMaintenancePlan
    {
        return DB::transaction(function () use ($plan, $data, $actor) {
            $plan = VehicleMaintenancePlan::query()->lockForUpdate()->findOrFail($plan->id);
            $vehicle = Vehicle::query()->with('currentCondition')->lockForUpdate()->findOrFail($plan->vehicle_id);
            $trigger = MaintenanceTriggerType::from($data['trigger_type']);

            $baselineOdometer = null;
            if ($trigger->usesMileage()) {
                $baselineOdometer = $plan->last_completed_odometer
                    ?? $plan->baseline_odometer
                    ?? $vehicle->currentCondition?->odometer;
                if ($baselineOdometer === null) {
                    throw ValidationException::withMessages([
                        'vehicle_id' => ['Set the vehicle Current Condition odometer before using a mileage trigger.'],
                    ]);
                }
            }

            $baselineDate = null;
            if ($trigger->usesDate()) {
                $baselineDate = $plan->last_completed_at?->toDateString()
                    ?? $plan->baseline_date?->toDateString()
                    ?? $plan->created_at?->toDateString()
                    ?? today()->toDateString();
            }

            $plan->update([
                ...$this->normalizedPlanData($data, $trigger),
                'baseline_odometer' => $baselineOdometer,
                'baseline_date' => $baselineDate,
                'next_due_odometer' => $trigger->usesMileage()
                    ? $baselineOdometer + (int) $data['interval_km']
                    : null,
                'next_due_date' => $trigger->usesDate()
                    ? Carbon::parse($baselineDate)->addDays((int) $data['interval_days'])->toDateString()
                    : null,
            ]);

            activity()->causedBy($actor)->performedOn($plan)->event('maintenance_plan_updated')
                ->log('Maintenance plan updated.');

            return $this->loadPlan($plan);
        });
    }

    /** @return array{deleted: bool, archived: bool} */
    public function deletePlan(VehicleMaintenancePlan $plan, User $actor): array
    {
        return DB::transaction(function () use ($plan, $actor) {
            $plan = VehicleMaintenancePlan::query()->lockForUpdate()->findOrFail($plan->id);
            if ($plan->records()->whereIn('status', [
                MaintenanceRecordStatus::Scheduled,
                MaintenanceRecordStatus::InProgress,
            ])->exists()) {
                throw ValidationException::withMessages([
                    'plan' => ['Resolve the scheduled or in-progress maintenance before deleting this plan.'],
                ]);
            }

            if (! $plan->records()->exists()) {
                activity()->causedBy($actor)->performedOn($plan)->event('maintenance_plan_deleted')
                    ->withProperties(['vehicle_id' => $plan->vehicle_id])->log('Unused maintenance plan deleted.');
                $plan->delete();

                return ['deleted' => true, 'archived' => false];
            }

            $plan->update(['is_active' => false]);
            activity()->causedBy($actor)->performedOn($plan)->event('maintenance_plan_deactivated')
                ->log('Maintenance plan deactivated to preserve its history.');

            return ['deleted' => false, 'archived' => true];
        });
    }

    public function schedule(array $data, User $actor): VehicleMaintenanceRecord
    {
        return DB::transaction(function () use ($data, $actor) {
            $vehicle = Vehicle::query()->lockForUpdate()->findOrFail($data['vehicle_id']);
            $plan = null;
            if (isset($data['maintenance_plan_id'])) {
                $plan = VehicleMaintenancePlan::query()->lockForUpdate()
                    ->where('vehicle_id', $vehicle->id)->where('is_active', true)
                    ->findOrFail($data['maintenance_plan_id']);
                if ($plan->records()->whereIn('status', [
                    MaintenanceRecordStatus::Scheduled,
                    MaintenanceRecordStatus::InProgress,
                ])->exists()) {
                    throw ValidationException::withMessages([
                        'maintenance_plan_id' => ['This plan already has scheduled or in-progress maintenance. Open that record instead.'],
                    ]);
                }
            }

            $this->availabilityService->assertMaintenanceIntervalAvailable(
                $vehicle->id,
                $data['scheduled_start'],
                $data['scheduled_end']
            );

            $record = VehicleMaintenanceRecord::create([
                'vehicle_id' => $vehicle->id,
                'maintenance_plan_id' => $plan?->id,
                'title' => $plan?->name ?? $data['title'],
                'category' => $plan?->category ?? $data['category'],
                'description' => $plan?->description ?? ($data['description'] ?? null),
                'scheduled_start' => $data['scheduled_start'],
                'scheduled_end' => $data['scheduled_end'],
                'service_provider' => $data['service_provider'] ?? null,
                'notes' => $data['notes'] ?? null,
                'status' => MaintenanceRecordStatus::Scheduled,
                'created_by' => $actor->id,
            ]);

            activity()->causedBy($actor)->performedOn($record)->event('maintenance_scheduled')
                ->withProperties([
                    'vehicle_id' => $vehicle->id,
                    'maintenance_plan_id' => $plan?->id,
                    'scheduled_start' => $record->scheduled_start,
                    'scheduled_end' => $record->scheduled_end,
                ])->log('Maintenance scheduled.');

            return $record->load($this->relations());
        });
    }

    public function reschedule(VehicleMaintenanceRecord $record, array $data, User $actor): VehicleMaintenanceRecord
    {
        return DB::transaction(function () use ($record, $data, $actor) {
            $record = VehicleMaintenanceRecord::query()->lockForUpdate()->findOrFail($record->id);
            Vehicle::query()->lockForUpdate()->findOrFail($record->vehicle_id);
            $this->assertState($record, MaintenanceRecordStatus::Scheduled);
            $this->availabilityService->assertMaintenanceIntervalAvailable(
                $record->vehicle_id,
                $data['scheduled_start'],
                $data['scheduled_end'],
                $record->id
            );

            $previous = [
                'scheduled_start' => $record->scheduled_start?->toISOString(),
                'scheduled_end' => $record->scheduled_end?->toISOString(),
            ];
            $record->update([
                'scheduled_start' => $data['scheduled_start'],
                'scheduled_end' => $data['scheduled_end'],
            ]);

            activity()->causedBy($actor)->performedOn($record)->event('maintenance_rescheduled')
                ->withProperties([
                    'previous' => $previous,
                    'scheduled_start' => $record->scheduled_start,
                    'scheduled_end' => $record->scheduled_end,
                ])->log('Maintenance rescheduled.');

            return $record->load($this->relations());
        });
    }

    public function start(VehicleMaintenanceRecord $record, User $actor): VehicleMaintenanceRecord
    {
        return DB::transaction(function () use ($record, $actor) {
            $record = VehicleMaintenanceRecord::query()->lockForUpdate()->findOrFail($record->id);
            $vehicle = Vehicle::query()->lockForUpdate()->findOrFail($record->vehicle_id);
            $this->assertState($record, MaintenanceRecordStatus::Scheduled);
            if ($vehicle->bookings()->where('status', BookingStatus::Ongoing)->exists()
                || $vehicle->status !== VehicleStatus::Available) {
                throw ValidationException::withMessages([
                    'status' => ['Maintenance cannot start while the vehicle is operationally unavailable or rented.'],
                ]);
            }

            $record->update([
                'status' => MaintenanceRecordStatus::InProgress,
                'actual_started_at' => now(),
                'started_by' => $actor->id,
                'odometer_at_start' => $vehicle->currentCondition?->odometer,
            ]);
            $vehicle->update(['status' => VehicleStatus::Maintenance]);
            activity()->causedBy($actor)->performedOn($record)->event('maintenance_started')
                ->log('Maintenance started.');

            return $record->load($this->relations());
        });
    }

    public function complete(VehicleMaintenanceRecord $record, array $data, User $actor): VehicleMaintenanceRecord
    {
        return DB::transaction(function () use ($record, $data, $actor) {
            $record = VehicleMaintenanceRecord::query()->with('plan')->lockForUpdate()->findOrFail($record->id);
            $vehicle = Vehicle::query()->with('currentCondition')->lockForUpdate()->findOrFail($record->vehicle_id);
            $this->assertState($record, MaintenanceRecordStatus::InProgress);

            $completionOdometer = $data['odometer_at_completion'] ?? null;
            if ($record->plan?->trigger_type->usesMileage() && $completionOdometer === null) {
                throw ValidationException::withMessages([
                    'odometer_at_completion' => ['The completion odometer is required for a mileage-based maintenance plan.'],
                ]);
            }
            if ($completionOdometer !== null) {
                $minimum = max(
                    (int) ($vehicle->currentCondition?->odometer ?? 0),
                    (int) ($record->odometer_at_start ?? 0)
                );
                if ((int) $completionOdometer < $minimum) {
                    throw ValidationException::withMessages([
                        'odometer_at_completion' => ["The completion odometer cannot be lower than {$minimum} km."],
                    ]);
                }
            }

            $conditionRequired = $record->condition_verification_required
                || ($completionOdometer !== null && (int) $completionOdometer !== $vehicle->currentCondition?->odometer)
                || $record->category === MaintenanceCategory::BodyRepair
                || (in_array($record->category, [MaintenanceCategory::Corrective, MaintenanceCategory::Other], true)
                    && ($data['condition_changed'] ?? false));
            if ($conditionRequired && ! $vehicle->currentCondition) {
                throw ValidationException::withMessages([
                    'odometer_at_completion' => ['Set the initial vehicle condition before completing maintenance with this odometer reading.'],
                ]);
            }
            $record->update([
                'odometer_at_completion' => $completionOdometer,
                'work_performed' => $data['work_performed'] ?? $record->work_performed,
                'service_provider' => $record->service_provider ?? ($data['service_provider'] ?? null),
                'labor_cost' => $data['labor_cost'] ?? null,
                'parts_cost' => $data['parts_cost'] ?? null,
                'other_cost' => $data['other_cost'] ?? null,
                'notes' => $data['notes'] ?? $record->notes,
                'condition_verification_required' => $conditionRequired,
                'completion_details_recorded_at' => now(),
            ]);

            if ($conditionRequired) {
                activity()->causedBy($actor)->performedOn($record)
                    ->event('maintenance_completion_details_recorded')
                    ->log('Maintenance completion details recorded pending vehicle condition verification.');

                return $record->load($this->relations());
            }

            return $this->finalizeCompletion($record, $vehicle, $actor);
        });
    }

    public function cancel(VehicleMaintenanceRecord $record, User $actor, ?string $reason = null): VehicleMaintenanceRecord
    {
        return DB::transaction(function () use ($record, $actor, $reason) {
            $record = VehicleMaintenanceRecord::query()->lockForUpdate()->findOrFail($record->id);
            $this->assertState($record, MaintenanceRecordStatus::Scheduled);
            $record->update([
                'status' => MaintenanceRecordStatus::Cancelled,
                'cancelled_at' => now(),
                'cancelled_by' => $actor->id,
                'cancellation_reason' => filled($reason) ? trim($reason) : null,
            ]);
            activity()->causedBy($actor)->performedOn($record)->event('maintenance_cancelled')
                ->log('Maintenance cancelled.');

            return $record->load($this->relations());
        });
    }

    public function currentConditionForVerification(VehicleMaintenanceRecord $record): VehicleInspection
    {
        $record->loadMissing('vehicle.currentCondition');
        $this->assertConditionVerificationPending($record);

        $inspection = $record->vehicle?->currentCondition;
        if (! $inspection) {
            throw ValidationException::withMessages([
                'condition' => ['Set the vehicle Current Condition before completing condition verification.'],
            ]);
        }

        return $inspection->load(['items', 'markers', 'signatures', 'creator:id,name', 'basedOnInspection']);
    }

    public function linkResultingCondition(
        VehicleMaintenanceRecord $record,
        VehicleInspection $inspection,
        User $actor
    ): VehicleMaintenanceRecord {
        return DB::transaction(function () use ($record, $inspection, $actor) {
            $record = VehicleMaintenanceRecord::query()->with(['plan', 'vehicle'])->lockForUpdate()->findOrFail($record->id);
            $vehicle = Vehicle::query()->lockForUpdate()->findOrFail($record->vehicle_id);
            $inspection = VehicleInspection::query()->lockForUpdate()->findOrFail($inspection->id);
            $this->assertConditionVerificationPending($record);

            $validReason = $record->category === MaintenanceCategory::BodyRepair
                ? $inspection->condition_update_reason === VehicleConditionUpdateReason::RepairCompleted
                : in_array($inspection->condition_update_reason, [
                    VehicleConditionUpdateReason::MaintenanceCompleted,
                    VehicleConditionUpdateReason::RepairCompleted,
                ], true);
            if ($inspection->vehicle_id !== $record->vehicle_id
                || $inspection->id !== $vehicle->current_condition_inspection_id
                || $inspection->status !== VehicleInspectionStatus::Finalized
                || $inspection->type !== VehicleInspectionType::ConditionUpdate
                || ($record->odometer_at_completion !== null && $inspection->odometer !== $record->odometer_at_completion)
                || $inspection->finalized_at?->lt($record->completion_details_recorded_at)
                || ! $validReason) {
                throw ValidationException::withMessages([
                    'inspection_id' => ['Use the newly finalized maintenance condition update with the recorded completion odometer.'],
                ]);
            }

            $record->update(['resulting_condition_inspection_id' => $inspection->id]);
            activity()->causedBy($actor)->performedOn($record)->event('maintenance_condition_linked')
                ->withProperties(['inspection_id' => $inspection->id])->log('Resulting vehicle condition linked.');

            return $this->finalizeCompletion($record, $vehicle, $actor);
        });
    }

    private function finalizeCompletion(
        VehicleMaintenanceRecord $record,
        Vehicle $vehicle,
        User $actor
    ): VehicleMaintenanceRecord {
        $completedAt = now();
        $record->update([
            'status' => MaintenanceRecordStatus::Completed,
            'completed_at' => $completedAt,
            'completed_by' => $actor->id,
        ]);

        if ($record->maintenance_plan_id) {
            $plan = VehicleMaintenancePlan::query()->lockForUpdate()->find($record->maintenance_plan_id);
            if ($plan) {
                $changes = [];
                if ($plan->trigger_type->usesMileage()) {
                    $completionOdometer = (int) $record->odometer_at_completion;
                    $changes['baseline_odometer'] = $completionOdometer;
                    $changes['next_due_odometer'] = $completionOdometer + (int) $plan->interval_km;
                }
                if ($plan->trigger_type->usesDate()) {
                    $changes['baseline_date'] = $completedAt->toDateString();
                    $changes['next_due_date'] = $completedAt->copy()
                        ->addDays((int) $plan->interval_days)->toDateString();
                }
                $plan->update($changes);
            }
        }

        $this->operationalStatusService->afterMaintenanceEnded($vehicle);
        activity()->causedBy($actor)->performedOn($record)->event('maintenance_completed')
            ->withProperties([
                'vehicle_id' => $vehicle->id,
                'completed_at' => $completedAt,
                'total_cost' => (float) $record->total_cost,
            ])->log('Maintenance completed.');

        return $record->load($this->relations());
    }

    private function assertState(VehicleMaintenanceRecord $record, MaintenanceRecordStatus $expected): void
    {
        if ($record->status !== $expected) {
            throw ValidationException::withMessages([
                'status' => ["Only {$expected->label()} maintenance records can use this action."],
            ]);
        }
    }

    private function assertConditionVerificationPending(VehicleMaintenanceRecord $record): void
    {
        if ($record->status !== MaintenanceRecordStatus::InProgress
            || ! $record->condition_verification_required
            || $record->completion_details_recorded_at === null) {
            throw ValidationException::withMessages([
                'condition' => ['Record the maintenance completion details before condition verification.'],
            ]);
        }
    }

    private function normalizedPlanData(array $data, MaintenanceTriggerType $trigger): array
    {
        return [
            'vehicle_id' => $data['vehicle_id'],
            'name' => $data['name'],
            'category' => $data['category'],
            'description' => $data['description'] ?? null,
            'trigger_type' => $trigger,
            'interval_km' => $trigger->usesMileage() ? $data['interval_km'] : null,
            'interval_days' => $trigger->usesDate() ? $data['interval_days'] : null,
        ];
    }

    private function loadPlan(VehicleMaintenancePlan $plan): VehicleMaintenancePlan
    {
        return $plan->load(['vehicle.currentCondition', 'creator', 'activeRecord'])
            ->loadCount('records');
    }

    private function relations(): array
    {
        return [
            'vehicle.images',
            'vehicle.currentCondition',
            'plan.vehicle.currentCondition',
            'creator:id,name',
            'starter:id,name',
            'completer:id,name',
            'canceller:id,name',
            'resultingConditionInspection.items',
            'resultingConditionInspection.markers',
            'resultingConditionInspection.signatures',
            'resultingConditionInspection.creator:id,name',
            'resultingConditionInspection.basedOnInspection',
        ];
    }
}
