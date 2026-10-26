<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RcResearchNativeAccessResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'owner_id' => (string) $this->resource['owner_id'],
            'valid_for_seconds' => $this->resource['valid_for_seconds'],
            'expires_at' => $this->resource['expires_at'],
            'capture_protocol_version' => 2,
            'upload_available' => true,
        ];
    }
}
