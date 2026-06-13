<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
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
        $perPage = max(1, min(100, (int) $request->integer('per_page', 10)));
        $vehicles = $this->vehicleService->paginate(
            $request->only(['search', 'status', 'brand', 'transmission']),
            $perPage
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
}
