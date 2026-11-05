<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RcNativeRecordingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'client_recording_id' => $this->client_recording_id,
            'name' => $this->name, 'display_code' => $this->whenLoaded('collectionContext', fn () => $this->collectionContext?->display_code), 'surface' => $this->surface, 'state' => $this->state,
            'capture_state' => $this->capture_state, 'duration_ms' => $this->duration_ms,
            'started_at' => $this->started_at->toISOString(), 'verified_at' => $this->verified_at?->toISOString(),
            'manifest_sha256' => $this->manifest_sha256, 'expected_chunks' => $this->expected_chunks,
            'received_chunks' => $this->whenCounted('chunks'), 'summary' => $this->summary,
            'annotation_state' => $this->relationLoaded('latestAnnotation') ? ($this->latestAnnotation?->state ?? 'unlabeled') : 'unlabeled',
            'protocol_version' => 2, 'source' => 'android_sensor_manager_v2',
            'accepted_chunks' => $this->whenLoaded('chunks', fn () => $this->chunks->map(fn ($chunk) => [
                'channel' => $chunk->channel, 'chunk_index' => $chunk->chunk_index])->values())];
    }
}
