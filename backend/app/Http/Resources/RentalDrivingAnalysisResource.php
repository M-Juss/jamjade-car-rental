<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RentalDrivingAnalysisResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'sensor_platform' => $this->resource['sensor_platform'],
            'operator' => $this->resource['operator'],
            'coverage' => $this->resource['coverage'],
            'session_status' => $this->resource['session_status'],
            'sync_pending' => $this->resource['sync_pending'],
            'latest_received_at' => $this->resource['latest_received_at'],
            'event_summary' => $this->resource['event_summary'],
            'maneuvers' => $this->resource['maneuvers'],
            'grading' => $this->resource['grading'],
            'events' => FleetDrivingEventResource::collection($this->resource['events'])->resolve($request),
        ];
    }
}
