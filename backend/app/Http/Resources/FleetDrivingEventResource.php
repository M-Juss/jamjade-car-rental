<?php

namespace App\Http\Resources;

use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FleetDrivingEventResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'target' => $this->target,
            'status' => $this->status,
            'start_ms' => $this->start_ms,
            'end_ms' => $this->end_ms,
            'occurred_at' => $this->occurred_ms === null ? null : CarbonImmutable::createFromTimestampMs($this->occurred_ms, 'UTC')->toISOString(),
            'received_at' => $this->created_at->toISOString(),
        ];
    }
}
