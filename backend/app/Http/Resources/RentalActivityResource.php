<?php

namespace App\Http\Resources;

use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RentalActivityResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $activity = [
            'id' => (string) $this->source_id,
            'kind' => $this->kind,
            'occurredAt' => CarbonImmutable::createFromTimestampMs((int) $this->occurred_ms, 'UTC')->toISOString(),
        ];

        return $this->kind === 'maneuver'
            ? [...$activity, 'target' => $this->target, 'status' => $this->status]
            : [...$activity, 'title' => $this->title, 'message' => $this->message, 'isRead' => $this->read_at !== null];
    }
}
