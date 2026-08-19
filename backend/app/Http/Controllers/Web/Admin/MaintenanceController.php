<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Maintenance\CancelMaintenanceRequest;
use App\Http\Requests\Maintenance\CompleteMaintenanceRequest;
use App\Http\Requests\Maintenance\ListMaintenanceRequest;
use App\Http\Requests\Maintenance\RescheduleMaintenanceRequest;
use App\Http\Requests\Maintenance\ScheduleMaintenanceRequest;
use App\Http\Requests\Maintenance\StartMaintenanceRequest;
use App\Http\Requests\Maintenance\StoreMaintenanceConditionUpdateRequest;
use App\Http\Requests\Maintenance\StoreMaintenancePlanRequest;
use App\Http\Requests\Maintenance\UpdateMaintenancePlanRequest;
use App\Http\Resources\MaintenancePlanResource;
use App\Http\Resources\MaintenanceRecordResource;
use App\Http\Resources\MaintenanceVehicleResource;
use App\Http\Resources\VehicleInspectionResource;
use App\Models\Vehicle;
use App\Models\VehicleInspection;
use App\Models\VehicleMaintenancePlan;
use App\Models\VehicleMaintenanceRecord;
use App\Services\MaintenanceService;
use App\Services\VehicleInspectionService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MaintenanceController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        private readonly MaintenanceService $service,
        private readonly VehicleInspectionService $inspectionService
    ) {}

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
        $vehicles = Vehicle::query()->with(['currentCondition:id,odometer', 'dateBlockingBookings', 'activeMaintenanceRecords'])
            ->orderBy('brand')->orderBy('model')->get();

        return $this->success('Maintenance vehicles fetched successfully.', MaintenanceVehicleResource::collection($vehicles));
    }

    public function show(VehicleMaintenanceRecord $maintenanceRecord): JsonResponse
    {
        return $this->success('Maintenance record fetched successfully.', new MaintenanceRecordResource($maintenanceRecord->load([
            'vehicle.currentCondition',
            'plan.vehicle.currentCondition',
            'creator',
            'starter',
            'completer',
            'canceller',
            'resultingConditionInspection.items',
            'resultingConditionInspection.markers',
            'resultingConditionInspection.signatures',
            'resultingConditionInspection.creator',
            'resultingConditionInspection.basedOnInspection',
        ])));
    }

    public function schedule(ScheduleMaintenanceRequest $request): JsonResponse
    {
        return $this->created('Maintenance scheduled successfully.', new MaintenanceRecordResource($this->service->schedule($request->validated(), $request->user())));
    }

    public function start(StartMaintenanceRequest $request, VehicleMaintenanceRecord $maintenanceRecord): JsonResponse
    {
        return $this->success('Maintenance started successfully.', new MaintenanceRecordResource($this->service->start($maintenanceRecord, $request->user())));
    }

    public function reschedule(RescheduleMaintenanceRequest $request, VehicleMaintenanceRecord $maintenanceRecord): JsonResponse
    {
        return $this->success('Maintenance rescheduled successfully.', new MaintenanceRecordResource(
            $this->service->reschedule($maintenanceRecord, $request->validated(), $request->user())
        ));
    }

    public function complete(CompleteMaintenanceRequest $request, VehicleMaintenanceRecord $maintenanceRecord): JsonResponse
    {
        return $this->success('Maintenance completed successfully.', new MaintenanceRecordResource($this->service->complete($maintenanceRecord, $request->validated(), $request->user())));
    }

    public function cancel(CancelMaintenanceRequest $request, VehicleMaintenanceRecord $maintenanceRecord): JsonResponse
    {
        return $this->success('Maintenance cancelled successfully.', new MaintenanceRecordResource(
            $this->service->cancel($maintenanceRecord, $request->user(), $request->validated('reason'))
        ));
    }

    public function plans(): JsonResponse
    {
        $plans = VehicleMaintenancePlan::query()->where('is_active', true)
            ->with(['vehicle.currentCondition', 'creator', 'activeRecord'])
            ->withCount('records')->latest()->get();

        return $this->success('Maintenance plans fetched successfully.', MaintenancePlanResource::collection($plans));
    }

    public function vehiclePlans(Vehicle $vehicle): JsonResponse
    {
        $plans = VehicleMaintenancePlan::query()->where('is_active', true)
            ->with(['vehicle.currentCondition', 'creator', 'activeRecord'])
            ->withCount('records')->where('vehicle_id', $vehicle->id)->latest()->get();

        return $this->success('Vehicle maintenance plans fetched successfully.', MaintenancePlanResource::collection($plans));
    }

    public function storePlan(StoreMaintenancePlanRequest $request): JsonResponse
    {
        return $this->created('Maintenance plan created successfully.', new MaintenancePlanResource($this->service->createPlan($request->validated(), $request->user())));
    }

    public function updatePlan(UpdateMaintenancePlanRequest $request, VehicleMaintenancePlan $plan): JsonResponse
    {
        return $this->success('Maintenance plan updated successfully.', new MaintenancePlanResource(
            $this->service->updatePlan($plan, $request->validated(), $request->user())
        ));
    }

    public function deletePlan(Request $request, VehicleMaintenancePlan $plan): JsonResponse
    {
        $result = $this->service->deletePlan($plan, $request->user());

        return $this->success(
            $result['deleted'] ? 'Unused maintenance plan deleted successfully.' : 'Maintenance plan archived successfully.',
            $result
        );
    }

    public function conditionForCompletion(VehicleMaintenanceRecord $maintenanceRecord): JsonResponse
    {
        return $this->success(
            'Current vehicle condition fetched successfully.',
            new VehicleInspectionResource($this->service->currentConditionForVerification($maintenanceRecord))
        );
    }

    public function storeConditionForCompletion(
        StoreMaintenanceConditionUpdateRequest $request,
        VehicleMaintenanceRecord $maintenanceRecord
    ): JsonResponse {
        $this->service->currentConditionForVerification($maintenanceRecord);
        $completedRecord = null;
        $this->inspectionService->updateCurrentCondition(
            $maintenanceRecord->vehicle,
            $request->validated('condition'),
            $request->validated('reason'),
            $request->validated('notes'),
            $request->user(),
            function (VehicleInspection $inspection) use ($maintenanceRecord, $request, &$completedRecord): void {
                $completedRecord = $this->service->linkResultingCondition($maintenanceRecord, $inspection, $request->user());
            }
        );

        return $this->success('Condition verified and maintenance completed successfully.', new MaintenanceRecordResource(
            $completedRecord
        ));
    }

    public function linkCondition(Request $request, VehicleMaintenanceRecord $maintenanceRecord): JsonResponse
    {
        $data = $request->validate(['inspection_id' => ['required', 'integer', 'exists:vehicle_inspections,id']]);

        return $this->success('Resulting condition linked successfully.', new MaintenanceRecordResource(
            $this->service->linkResultingCondition($maintenanceRecord, VehicleInspection::findOrFail($data['inspection_id']), $request->user())
        ));
    }
}
