<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\MaintenanceRecordStatus;
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
            'completed' => VehicleMaintenanceRecord::where('status', MaintenanceRecordStatus::Completed)->count(),
            'cancelled' => VehicleMaintenanceRecord::where('status', MaintenanceRecordStatus::Cancelled)->count(),
        ];
    }

    public function createPlan(array $data, User $actor): VehicleMaintenancePlan
    {
        $plan = VehicleMaintenancePlan::create([...$data, 'created_by' => $actor->id, 'is_active' => true]);
        activity()->causedBy($actor)->performedOn($plan)->event('maintenance_plan_created')
            ->withProperties(['vehicle_id' => $plan->vehicle_id])->log('Maintenance plan created.');

        return $plan->load(['vehicle.currentCondition', 'creator']);
    }

    public function updatePlan(VehicleMaintenancePlan $plan, array $data, User $actor): VehicleMaintenancePlan
    {
        $plan->update($data);
        activity()->causedBy($actor)->performedOn($plan)->event('maintenance_plan_updated')->log('Maintenance plan updated.');

        return $plan->load(['vehicle.currentCondition', 'creator']);
    }

    public function deactivatePlan(VehicleMaintenancePlan $plan, User $actor): VehicleMaintenancePlan
    {
        $plan->update(['is_active' => false]);
        activity()->causedBy($actor)->performedOn($plan)->event('maintenance_plan_deactivated')->log('Maintenance plan deactivated.');

        return $plan->load(['vehicle.currentCondition', 'creator']);
    }

    public function schedule(array $data, User $actor): VehicleMaintenanceRecord
    {
        return DB::transaction(function () use ($data, $actor) {
            $vehicle = Vehicle::query()->lockForUpdate()->findOrFail($data['vehicle_id']);
            $plan = isset($data['maintenance_plan_id'])
                ? VehicleMaintenancePlan::query()->where('vehicle_id', $vehicle->id)->where('is_active', true)->findOrFail($data['maintenance_plan_id']) : null;
            $this->availabilityService->assertMaintenanceIntervalAvailable($vehicle->id, $data['scheduled_start'], $data['scheduled_end']);

            $record = VehicleMaintenanceRecord::create([
                ...$data,
                'title' => $plan?->name ?? $data['title'],
                'category' => $plan?->category ?? $data['category'],
                'status' => MaintenanceRecordStatus::Scheduled,
                'created_by' => $actor->id,
            ]);
            activity()->causedBy($actor)->performedOn($record)->event('maintenance_scheduled')
                ->withProperties(['vehicle_id' => $vehicle->id, 'scheduled_start' => $record->scheduled_start, 'scheduled_end' => $record->scheduled_end])
                ->log('Maintenance scheduled.');

            return $record->load($this->relations());
        });
    }

    public function start(VehicleMaintenanceRecord $record, User $actor): VehicleMaintenanceRecord
    {
        return DB::transaction(function () use ($record, $actor) {
            $record = VehicleMaintenanceRecord::query()->lockForUpdate()->findOrFail($record->id);
            $vehicle = Vehicle::query()->lockForUpdate()->findOrFail($record->vehicle_id);
            $this->assertState($record, MaintenanceRecordStatus::Scheduled);
            if ($vehicle->bookings()->where('status', BookingStatus::Ongoing)->exists() || $vehicle->status !== VehicleStatus::Available) {
                throw ValidationException::withMessages(['status' => ['Maintenance cannot start while the vehicle is operationally unavailable or rented.']]);
            }
            $currentOdometer = $vehicle->currentCondition?->odometer;
            $record->update([
                'status' => MaintenanceRecordStatus::InProgress,
                'actual_started_at' => now(),
                'started_by' => $actor->id,
                'odometer_at_start' => $currentOdometer,
            ]);
            $vehicle->update(['status' => VehicleStatus::Maintenance]);
            activity()->causedBy($actor)->performedOn($record)->event('maintenance_started')->log('Maintenance started.');

            return $record->load($this->relations());
        });
    }

    public function complete(VehicleMaintenanceRecord $record, array $data, User $actor): VehicleMaintenanceRecord
    {
        return DB::transaction(function () use ($record, $data, $actor) {
            $record = VehicleMaintenanceRecord::query()->lockForUpdate()->findOrFail($record->id);
            $vehicle = Vehicle::query()->lockForUpdate()->with('currentCondition')->findOrFail($record->vehicle_id);
            $this->assertState($record, MaintenanceRecordStatus::InProgress);
            $minimum = max((int) ($vehicle->currentCondition?->odometer ?? 0), (int) ($record->odometer_at_start ?? 0));
            if ((int) $data['odometer_at_completion'] < $minimum) {
                throw ValidationException::withMessages(['odometer_at_completion' => ["The completion odometer cannot be lower than {$minimum} km."]]);
            }
            $total = round((float) ($data['labor_cost'] ?? 0) + (float) ($data['parts_cost'] ?? 0) + (float) ($data['other_cost'] ?? 0), 2);
            $completedAt = now();
            $record->update([...$data, 'status' => MaintenanceRecordStatus::Completed, 'completed_at' => $completedAt,
                'completed_by' => $actor->id, 'total_cost' => $total]);

            if ($record->maintenance_plan_id) {
                $plan = VehicleMaintenancePlan::query()->lockForUpdate()->find($record->maintenance_plan_id);
                if ($plan) {
                    $changes = ['last_completed_at' => $completedAt, 'last_completed_odometer' => $data['odometer_at_completion']];
                    if ($plan->trigger_type->usesMileage()) {
                        $changes['next_due_odometer'] = $data['odometer_at_completion'] + $plan->interval_km;
                    }
                    if ($plan->trigger_type->usesDate()) {
                        $changes['next_due_date'] = $completedAt->copy()->addDays($plan->interval_days)->toDateString();
                    }
                    $plan->update($changes);
                }
            }

            $this->operationalStatusService->afterMaintenanceEnded($vehicle);
            activity()->causedBy($actor)->performedOn($record)->event('maintenance_completed')
                ->withProperties(['vehicle_id' => $vehicle->id, 'completed_at' => $completedAt, 'total_cost' => $total])
                ->log('Maintenance completed.');

            return $record->load($this->relations());
        });
    }

    public function cancel(VehicleMaintenanceRecord $record, User $actor): VehicleMaintenanceRecord
    {
        return DB::transaction(function () use ($record, $actor) {
            $record = VehicleMaintenanceRecord::query()->lockForUpdate()->findOrFail($record->id);
            $this->assertState($record, MaintenanceRecordStatus::Scheduled);
            $record->update(['status' => MaintenanceRecordStatus::Cancelled, 'cancelled_at' => now(), 'cancelled_by' => $actor->id]);
            activity()->causedBy($actor)->performedOn($record)->event('maintenance_cancelled')->log('Maintenance cancelled.');

            return $record->load($this->relations());
        });
    }

    public function linkResultingCondition(VehicleMaintenanceRecord $record, VehicleInspection $inspection, User $actor): VehicleMaintenanceRecord
    {
        if ($record->status !== MaintenanceRecordStatus::Completed || $inspection->vehicle_id !== $record->vehicle_id
            || $inspection->status !== VehicleInspectionStatus::Finalized || $inspection->type !== VehicleInspectionType::ConditionUpdate) {
            throw ValidationException::withMessages(['inspection_id' => ['Choose a finalized condition update for this vehicle and completed maintenance record.']]);
        }
        $record->update(['resulting_condition_inspection_id' => $inspection->id]);
        activity()->causedBy($actor)->performedOn($record)->event('maintenance_condition_linked')
            ->withProperties(['inspection_id' => $inspection->id])->log('Resulting vehicle condition linked.');

        return $record->load($this->relations());
    }

    private function assertState(VehicleMaintenanceRecord $record, MaintenanceRecordStatus $expected): void
    {
        if ($record->status !== $expected) {
            throw ValidationException::withMessages(['status' => ["Only {$expected->label()} maintenance records can use this action."]]);
        }
    }

    private function relations(): array
    {
        return ['vehicle.images', 'vehicle.currentCondition', 'plan.vehicle.currentCondition', 'creator:id,name', 'starter:id,name', 'completer:id,name', 'canceller:id,name', 'resultingConditionInspection'];
    }
}
