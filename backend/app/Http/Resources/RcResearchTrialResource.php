<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RcResearchTrialResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'session' => new RcResearchSessionResource($this->whenLoaded('session')),
            'intended_movement' => $this->intended_movement, 'intended_intensity' => $this->intended_intensity,
            'observed_movement' => $this->observed_movement, 'observed_intensity' => $this->observed_intensity,
            'label_status' => $this->label_status, 'quality' => $this->quality,
            'event_start_ms' => $this->event_start_ms, 'event_end_ms' => $this->event_end_ms,
            'notes' => $this->notes, 'summary' => $this->summary,
            'started_at' => $this->started_at?->toISOString(), 'ended_at' => $this->ended_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString()];
    }
}
