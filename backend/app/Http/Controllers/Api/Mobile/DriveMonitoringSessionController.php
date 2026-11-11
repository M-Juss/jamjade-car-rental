<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\Research\DriveMonitoringReferenceRequest;
use App\Http\Requests\Research\StartDriveMonitoringRequest;
use App\Http\Requests\Research\StoreDriveMonitoringBatchRequest;
use App\Http\Resources\DriveMonitoringSessionResource;
use App\Services\DriveMonitoringReferenceService;
use App\Services\DriveMonitoringSessionService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DriveMonitoringSessionController extends Controller
{
    use ApiResponseTrait;

    public function reference(DriveMonitoringReferenceRequest $request, DriveMonitoringReferenceService $references): JsonResponse
    {
        return $this->success('Monitoring reference fetched.', $references->latest($request->user(),
            $request->validated('research_session_id'), $request->validated('mount_version_id')))
            ->header('Cache-Control', 'private, no-store');
    }

    public function store(StartDriveMonitoringRequest $request, DriveMonitoringSessionService $sessions): JsonResponse
    {
        return $this->success('Monitoring session opened.',
            new DriveMonitoringSessionResource($sessions->start($request->user(), $request->validated())))
            ->header('Cache-Control', 'private, no-store');
    }

    public function stop(Request $request, string $session, DriveMonitoringSessionService $sessions): JsonResponse
    {
        return $this->success('Monitoring stopped.',
            new DriveMonitoringSessionResource($sessions->stop($request->user(), $session)))
            ->header('Cache-Control', 'private, no-store');
    }

    public function batch(StoreDriveMonitoringBatchRequest $request, string $session, DriveMonitoringSessionService $sessions): JsonResponse
    {
        return $this->success('Monitoring batch received.',
            $sessions->batch($request->user(), $session, $request->validated()))
            ->header('Cache-Control', 'private, no-store');
    }
}
