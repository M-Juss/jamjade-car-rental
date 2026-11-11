<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DriveMonitoringSessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'client_session_id' => $this->client_session_id,
            'telematics_trip_id' => $this->telematics_trip_id, 'sensor_platform' => $this->sensor_platform,
            'reference_run_id' => $this->reference_run_id, 'status' => $this->status,
            'analyzed_through_ms' => (int) $this->last_window_end_ms,
            'research_session_id' => $this->research_session_id, 'mount_version_id' => $this->mount_version_id,
            'research_session_number' => $this->whenLoaded('researchSession', fn () => (int) $this->researchSession->session_number),
            'runtime_reference' => $this->when($request->routeIs('mobile.rc-research.*', 'mobile.motion-monitoring.start'), fn () => $this->runtime_reference),
            'model_sha256' => $this->model_sha256, 'created_at' => $this->created_at->toISOString(),
            'ended_at' => $this->ended_at?->toISOString()];
    }
}
