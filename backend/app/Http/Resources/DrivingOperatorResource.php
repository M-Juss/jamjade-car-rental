<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DrivingOperatorResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => (int) $this->operator_id, 'name' => $this->operator_name,
            'completed_rentals' => (int) $this->completed_rentals, 'monitored_rentals' => (int) $this->monitored_rentals,
            'average_score' => $this->average_score === null ? null : round((float) $this->average_score, 1),
            'latest_score' => $this->latest_score === null ? null : (int) $this->latest_score,
            'harsh_events' => (int) $this->harsh_events];
    }
}
