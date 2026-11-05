<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RcCollectionStatusResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'client_recording_id' => $this->client_recording_id, 'name' => $this->name,
            'state' => $this->state, 'manifest_sha256' => $this->manifest_sha256,
            'context_synced' => $this->collectionContext !== null,
            'display_code' => $this->collectionContext?->display_code,
            'observation_revision' => $this->latestObservation?->revision ?? 0,
            'annotation_version' => 'rc-phase-labels-v1', 'annotation_state' => $this->latestAnnotation?->state ?? 'unlabeled',
            'checked_at' => now()->toISOString()];
    }
}
