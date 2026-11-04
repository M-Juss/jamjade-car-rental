<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RcProcessingRunResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'recording_id' => $this->recording_id, 'version' => $this->version,
            'reference_run_id' => $this->reference_run_id,
            'cutoff_hz' => $this->cutoff_hz, 'fingerprint' => $this->fingerprint,
            'created_at' => $this->created_at->toISOString()];
    }
}
