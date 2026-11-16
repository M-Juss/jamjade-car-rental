<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\Vehicle\ListVehiclesRequest;
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

    public function index(ListVehiclesRequest $request): JsonResponse
    {
        $filters = $request->safe()->only(['search', 'brand', 'transmission']);
        $vehicles = $this->vehicleService->paginateMobileCatalog(
            $filters,
            $request->integer('per_page', 10),
            $this->customerId($request),
        );

        return $this->paginated('Vehicles fetched successfully.', $vehicles, VehicleResource::class);
    }

    public function show(Request $request, Vehicle $vehicle): JsonResponse
    {
        return $this->success(
            'Vehicle fetched successfully.',
            new VehicleResource($this->vehicleService->mobileCatalogVehicle($vehicle->id, $this->customerId($request)))
        );
    }

    private function customerId(Request $request): ?int
    {
        return $request->routeIs('mobile.customer.vehicles.*') ? $request->user()->id : null;
    }
}
