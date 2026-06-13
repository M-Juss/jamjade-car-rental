<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\Telematics\EndTripRequest;
use App\Http\Requests\Telematics\StartTripRequest;
use App\Http\Requests\Telematics\StoreLocationRequest;
use App\Http\Requests\Telematics\StoreTelematicsEventRequest;
use App\Http\Resources\TelematicsEventResource;
use App\Http\Resources\TelematicsTripResource;
use App\Models\TelematicsTrip;
use App\Services\TelematicsService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TelematicsController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly TelematicsService $telematicsService) {}

    public function start(StartTripRequest $request): JsonResponse
    {
        $trip = $this->telematicsService->startTrip($request->user(), $request->validated());

        return $this->created('Telematics trip started successfully.', new TelematicsTripResource($trip));
    }

    public function pause(Request $request, TelematicsTrip $trip): JsonResponse
    {
        $trip = $this->telematicsService->pauseTrip($trip, $request->user());

        return $this->success('Telematics trip paused successfully.', new TelematicsTripResource($trip));
    }

    public function resume(Request $request, TelematicsTrip $trip): JsonResponse
    {
        $trip = $this->telematicsService->resumeTrip($trip, $request->user());

        return $this->success('Telematics trip resumed successfully.', new TelematicsTripResource($trip));
    }

    public function event(StoreTelematicsEventRequest $request, TelematicsTrip $trip): JsonResponse
    {
        $event = $this->telematicsService->storeEvent($trip, $request->validated(), $request->user());

        return $this->created('Telematics event stored successfully.', new TelematicsEventResource($event));
    }

    public function location(StoreLocationRequest $request, TelematicsTrip $trip): JsonResponse
    {
        $trip = $this->telematicsService->storeLocation($trip, $request->validated(), $request->user());

        return $this->success('Telematics location updated successfully.', new TelematicsTripResource($trip));
    }

    public function end(EndTripRequest $request, TelematicsTrip $trip): JsonResponse
    {
        $trip = $this->telematicsService->endTrip($trip, $request->user(), $request->validated());

        return $this->success('Telematics trip ended successfully.', new TelematicsTripResource($trip));
    }
}
