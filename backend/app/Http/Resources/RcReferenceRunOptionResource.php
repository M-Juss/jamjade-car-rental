<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RcReferenceRunOptionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return array_intersect_key($this->resource, array_flip(['id', 'recording_id', 'recording_name', 'created_at',
            'cutoff_hz', 'compatible', 'unavailable_reason']));
    }
}
