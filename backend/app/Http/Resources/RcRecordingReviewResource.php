<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RcRecordingReviewResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['collection' => $this->resource['collection'], 'observation' => $this->resource['observation'],
            'processing' => $this->resource['processing']];
    }
}
