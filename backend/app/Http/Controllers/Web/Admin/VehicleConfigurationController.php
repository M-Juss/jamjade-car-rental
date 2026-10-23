<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Vehicle\Configuration\SaveVehicleOptionRequest;
use App\Http\Resources\VehicleConfigurationOptionResource;
use App\Models\VehicleConfigurationOption;
use App\Services\VehicleConfigurationService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VehicleConfigurationController extends Controller
{
    use ApiResponseTrait;

    public function options(VehicleConfigurationService $service): JsonResponse
    {
        return $this->success('Vehicle options.', $service->options());
    }

    public function index(VehicleConfigurationService $service): JsonResponse
    {
        return $this->success('Vehicle configuration.', VehicleConfigurationOptionResource::collection($service->allOptions()));
    }

    public function store(SaveVehicleOptionRequest $request, VehicleConfigurationService $service): JsonResponse
    {
        return $this->created('Option added.', new VehicleConfigurationOptionResource($service->save($request->validated(), $request->user())));
    }

    public function update(SaveVehicleOptionRequest $request, VehicleConfigurationOption $option, VehicleConfigurationService $service): JsonResponse
    {
        return $this->success('Option saved.', new VehicleConfigurationOptionResource($service->save($request->validated(), $request->user(), $option)));
    }

    public function destroy(Request $request, VehicleConfigurationOption $option, VehicleConfigurationService $service): JsonResponse
    {
        $service->remove($option, $request->user());

        return $this->noData('Option removed.');
    }
}
