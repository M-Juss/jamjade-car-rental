<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Maintenance\CompleteMaintenanceRequest;
use App\Http\Requests\Maintenance\ListMaintenanceRequest;
use App\Http\Requests\Maintenance\ScheduleMaintenanceRequest;
use App\Http\Requests\Maintenance\StartMaintenanceRequest;
use App\Http\Requests\Maintenance\StoreMaintenancePlanRequest;
use App\Http\Requests\Maintenance\UpdateMaintenancePlanRequest;
use App\Http\Resources\MaintenancePlanResource;
use App\Http\Resources\MaintenanceRecordResource;
use App\Http\Resources\VehicleResource;
use App\Models\Vehicle;
use App\Models\VehicleInspection;
use App\Models\VehicleMaintenancePlan;
use App\Models\VehicleMaintenanceRecord;
use App\Services\MaintenanceService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MaintenanceController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly MaintenanceService $service) {}

    public function index(ListMaintenanceRequest $request): JsonResponse
    {
        $records = $this->service->paginate($request->safe()->only(['vehicle_id', 'status', 'search']), $request->integer('per_page', 15));

        return $this->paginated('Maintenance records fetched successfully.', $records, MaintenanceRecordResource::class);
    }

    public function summary(): JsonResponse
    {
        return $this->success('Maintenance summary fetched successfully.', $this->service->summary());
    }

    public function vehicles(): JsonResponse
    {
        $vehicles = Vehicle::query()->with(['images', 'features', 'dateBlockingBookings', 'scheduledMaintenanceWindows'])
            ->orderBy('brand')->orderBy('model')->get();

        return $this->success('Maintenance vehicles fetched successfully.', VehicleResource::collection($vehicles));
    }

    public function show(VehicleMaintenanceRecord $maintenanceRecord): JsonResponse
    {
        return $this->success('Maintenance record fetched successfully.', new MaintenanceRecordResource($maintenanceRecord->load(['vehicle.currentCondition', 'plan.vehicle.currentCondition', 'creator', 'starter', 'completer', 'canceller', 'resultingConditionInspection'])));
    }

    public function schedule(ScheduleMaintenanceRequest $request): JsonResponse
    {
        return $this->created('Maintenance scheduled successfully.', new MaintenanceRecordResource($this->service->schedule($request->validated(), $request->user())));
    }

    public function start(StartMaintenanceRequest $request, VehicleMaintenanceRecord $maintenanceRecord): JsonResponse
    {
        return $this->success('Maintenance started successfully.', new MaintenanceRecordResource($this->service->start($maintenanceRecord, $request->user())));
    }

    public function complete(CompleteMaintenanceRequest $request, VehicleMaintenanceRecord $maintenanceRecord): JsonResponse
    {
        return $this->success('Maintenance completed successfully.', new MaintenanceRecordResource($this->service->complete($maintenanceRecord, $request->validated(), $request->user())));
    }

    public function cancel(Request $request, VehicleMaintenanceRecord $maintenanceRecord): JsonResponse
    {
        return $this->success('Maintenance cancelled successfully.', new MaintenanceRecordResource($this->service->cancel($maintenanceRecord, $request->user())));
    }

    public function plans(): JsonResponse
    {
        $plans = VehicleMaintenancePlan::query()->with(['vehicle.currentCondition', 'creator'])
            ->latest()->get();

        return $this->success('Maintenance plans fetched successfully.', MaintenancePlanResource::collection($plans));
    }

    public function vehiclePlans(Vehicle $vehicle): JsonResponse
    {
        $plans = VehicleMaintenancePlan::query()->with(['vehicle.currentCondition', 'creator'])
            ->where('vehicle_id', $vehicle->id)->latest()->get();

        return $this->success('Vehicle maintenance plans fetched successfully.', MaintenancePlanResource::collection($plans));
    }

    public function storePlan(StoreMaintenancePlanRequest $request): JsonResponse
    {
        return $this->created('Maintenance plan created successfully.', new MaintenancePlanResource($this->service->createPlan($request->validated(), $request->user())));
    }

    public function updatePlan(UpdateMaintenancePlanRequest $request, VehicleMaintenancePlan $plan): JsonResponse
    {
        return $this->success('Maintenance plan updated successfully.', new MaintenancePlanResource($this->service->updatePlan($plan, $request->safe()->except('vehicle_id'), $request->user())));
    }

    public function deactivatePlan(Request $request, VehicleMaintenancePlan $plan): JsonResponse
    {
        return $this->success('Maintenance plan deactivated successfully.', new MaintenancePlanResource($this->service->deactivatePlan($plan, $request->user())));
    }

    public function linkCondition(Request $request, VehicleMaintenanceRecord $maintenanceRecord): JsonResponse
    {
        $data = $request->validate(['inspection_id' => ['required', 'integer', 'exists:vehicle_inspections,id']]);

        return $this->success('Resulting condition linked successfully.', new MaintenanceRecordResource(
            $this->service->linkResultingCondition($maintenanceRecord, VehicleInspection::findOrFail($data['inspection_id']), $request->user())
        ));
    }
}
