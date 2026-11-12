<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\Telematics\StartRentalMotionRequest;
use App\Http\Requests\Telematics\StopRentalMotionRequest;
use App\Http\Requests\Telematics\StoreRentalMotionBatchRequest;
use App\Http\Resources\DriveMonitoringSessionResource;
use App\Services\RentalMotionMonitoringService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\Request;

class RentalMotionMonitoringController extends Controller
{
    use ApiResponseTrait;

    public function show(Request $request, string $booking, RentalMotionMonitoringService $service)
    {
        return $this->success('Motion monitoring fetched.', $service->state($request->user(), $booking))->header('Cache-Control', 'private, no-store');
    }

    public function start(StartRentalMotionRequest $request, string $booking, RentalMotionMonitoringService $service)
    {
        return $this->success('Motion monitoring started.', new DriveMonitoringSessionResource($service->start($request->user(), $booking, $request->validated())))->header('Cache-Control', 'private, no-store');
    }

    public function batch(StoreRentalMotionBatchRequest $request, string $booking, string $session, RentalMotionMonitoringService $service)
    {
        return $this->success('Motion readings received.', $service->batch($request->user(), $booking, $session, $request->validated()))->header('Cache-Control', 'private, no-store');
    }

    public function stop(StopRentalMotionRequest $request, string $booking, string $session, RentalMotionMonitoringService $service)
    {
        $stopped = $service->stop($request->user(), $booking, $session, $request->validated('reason') === 'interrupted');

        return $this->success('Motion monitoring stopped.', new DriveMonitoringSessionResource($stopped))->header('Cache-Control', 'private, no-store');
    }
}
