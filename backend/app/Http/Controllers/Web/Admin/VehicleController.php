<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Vehicle\VehicleRequest;
use App\Http\Resources\VehicleResource;
use App\Models\Vehicle;
use App\Services\VehicleService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VehicleController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly VehicleService $vehicleService) {}

    public function index(Request $request): JsonResponse
    {
        $vehicles = $this->vehicleService->paginate(
            $request->only(['search', 'status', 'brand', 'transmission']),
            (int) $request->integer('per_page', 15)
        );

        return $this->paginated('Vehicles fetched successfully.', $vehicles, VehicleResource::class);
    }

    public function show(Vehicle $vehicle): JsonResponse
    {
        return $this->success(
            'Vehicle fetched successfully.',
            new VehicleResource($vehicle->load(['images', 'features', 'dateBlockingBookings']))
        );
    }

    public function store(VehicleRequest $request): JsonResponse
    {
        $vehicle = $this->vehicleService->create($request->validated());

        return $this->created('Vehicle created successfully.', new VehicleResource($vehicle));
    }

    public function update(VehicleRequest $request, Vehicle $vehicle): JsonResponse
    {
        $vehicle = $this->vehicleService->update($vehicle, $request->validated());

        return $this->success('Vehicle updated successfully.', new VehicleResource($vehicle));
    }

    public function destroy(Vehicle $vehicle): JsonResponse
    {
        $this->vehicleService->delete($vehicle);

        return $this->noData('Vehicle deleted successfully.');
    }
}
