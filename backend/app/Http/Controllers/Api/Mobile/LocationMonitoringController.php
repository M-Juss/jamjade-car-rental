<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\Telematics\LatestLocationRequest;
use App\Http\Requests\Telematics\PauseLocationMonitoringRequest;
use App\Http\Requests\Telematics\StartLocationMonitoringRequest;
use App\Http\Resources\LocationMonitoringResource;
use App\Services\LocationMonitoringService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LocationMonitoringController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly LocationMonitoringService $monitoring) {}

    public function show(Request $request, string $booking): JsonResponse
    {
        return $this->response(['booking' => $this->monitoring->bookingFor($request->user(), $booking)]);
    }

    public function start(StartLocationMonitoringRequest $request, string $booking): JsonResponse
    {
        return $this->response($this->monitoring->start($this->monitoring->bookingFor($request->user(), $booking), $request->user(), $request->validated()));
    }

    public function location(LatestLocationRequest $request, string $booking): JsonResponse
    {
        return $this->response(['booking' => $this->monitoring->update($this->monitoring->bookingFor($request->user(), $booking), $request->user(), $request->validated())]);
    }

    public function pause(PauseLocationMonitoringRequest $request, string $booking): JsonResponse
    {
        return $this->response(['booking' => $this->monitoring->pause($this->monitoring->bookingFor($request->user(), $booking), $request->user(), $request->validated('session_token'), $request->validated('reason', 'manual'))]);
    }

    private function response(array $state): JsonResponse
    {
        return $this->success('Location monitoring updated.', new LocationMonitoringResource($state))->header('Cache-Control', 'no-store');
    }
}
