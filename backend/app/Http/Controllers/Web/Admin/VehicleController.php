<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Vehicle\ListVehiclesRequest;
use App\Http\Requests\Vehicle\StoreInitialVehicleConditionRequest;
use App\Http\Requests\Vehicle\StoreVehicleConditionUpdateRequest;
use App\Http\Requests\Vehicle\VehicleRequest;
use App\Http\Resources\AdminVehicleResource;
use App\Http\Resources\VehicleInspectionResource;
use App\Models\Vehicle;
use App\Models\VehicleInspection;
use App\Services\VehicleInspectionService;
use App\Services\VehicleService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class VehicleController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        private readonly VehicleService $vehicleService,
        private readonly VehicleInspectionService $inspectionService
    ) {}

    public function index(ListVehiclesRequest $request): JsonResponse
    {
        $vehicles = $this->vehicleService->paginate(
            $request->safe()->only(['search', 'status', 'brand', 'transmission']),
            $request->integer('per_page', 15)
        );

        return $this->paginated('Vehicles fetched successfully.', $vehicles, AdminVehicleResource::class);
    }

    public function show(Vehicle $vehicle): JsonResponse
    {
        return $this->success(
            'Vehicle fetched successfully.',
            new AdminVehicleResource($vehicle->load([
                'images',
                'features',
                'dateBlockingBookings',
                'scheduledMaintenanceWindows',
                'ongoingBookings:id,vehicle_id,status',
                'currentCondition.items',
                'currentCondition.markers',
                'currentCondition.signatures.user:id,name',
                'currentCondition.creator:id,name',
                'currentCondition.booking:id,booking_code',
            ]))
        );
    }

    public function store(VehicleRequest $request): JsonResponse
    {
        $vehicle = $this->vehicleService->create($request->validated(), $request->user());

        return $this->created('Vehicle created successfully.', new AdminVehicleResource($vehicle));
    }

    public function update(VehicleRequest $request, Vehicle $vehicle): JsonResponse
    {
        $vehicle = $this->vehicleService->update($vehicle, $request->validated());

        return $this->success('Vehicle updated successfully.', new AdminVehicleResource($vehicle));
    }

    public function destroy(Vehicle $vehicle): JsonResponse
    {
        $this->vehicleService->delete($vehicle);

        return $this->noData('Vehicle deleted successfully.');
    }

    public function currentCondition(Vehicle $vehicle): JsonResponse
    {
        $inspection = $this->inspectionService->current($vehicle);

        return $this->success(
            $inspection ? 'Current vehicle condition fetched successfully.' : 'Initial vehicle condition has not been configured yet.',
            $inspection ? new VehicleInspectionResource($inspection) : null
        );
    }

    public function inspectionHistory(Vehicle $vehicle): JsonResponse
    {
        $history = $this->inspectionService->history($vehicle);

        return $this->paginated('Vehicle inspection history fetched successfully.', $history, VehicleInspectionResource::class);
    }

    public function inspection(Vehicle $vehicle, VehicleInspection $inspection): JsonResponse
    {
        return $this->success(
            'Vehicle inspection fetched successfully.',
            new VehicleInspectionResource($this->inspectionService->findForVehicle($vehicle, $inspection))
        );
    }

    public function storeInitialCondition(StoreInitialVehicleConditionRequest $request, Vehicle $vehicle): JsonResponse
    {
        $inspection = $this->inspectionService->configureInitial(
            $vehicle,
            $request->validated('condition'),
            $request->user()
        );

        return $this->created('Initial vehicle condition configured successfully.', new VehicleInspectionResource($inspection));
    }

    public function storeConditionUpdate(StoreVehicleConditionUpdateRequest $request, Vehicle $vehicle): JsonResponse
    {
        $inspection = $this->inspectionService->updateCurrentCondition(
            $vehicle,
            $request->validated('condition'),
            $request->validated('reason'),
            $request->validated('notes'),
            $request->user()
        );

        return $this->created('Current vehicle condition updated successfully.', new VehicleInspectionResource($inspection));
    }
}
