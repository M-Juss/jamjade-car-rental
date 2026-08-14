<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Enums\VehicleStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Vehicle\ListVehiclesRequest;
use App\Http\Resources\VehicleResource;
use App\Models\Vehicle;
use App\Services\VehicleService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class VehicleController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly VehicleService $vehicleService) {}

    public function index(ListVehiclesRequest $request): JsonResponse
    {
        $filters = $request->safe()->only(['search', 'brand', 'transmission']);
        $filters['status'] = VehicleStatus::Available->value;

        $vehicles = $this->vehicleService->paginate(
            $filters,
            $request->integer('per_page', 10)
        );

        return $this->paginated('Vehicles fetched successfully.', $vehicles, VehicleResource::class);
    }

    public function show(Vehicle $vehicle): JsonResponse
    {
        abort_unless($vehicle->status === VehicleStatus::Available, 404);

        return $this->success(
            'Vehicle fetched successfully.',
            new VehicleResource($vehicle->load(['images', 'features', 'dateBlockingBookings', 'scheduledMaintenanceWindows']))
        );
    }
}
