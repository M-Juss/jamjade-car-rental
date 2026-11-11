<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RcAnnotationRevisionResource extends JsonResource
{
    private bool $legacyLaneChange = false;

    public function forLegacyLaneChange(): self
    {
        $this->legacyLaneChange = true;

        return $this;
    }

    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'revision' => $this->revision, 'state' => $this->state,
            'version' => 'rc-phase-labels-v1', 'manifest_sha256' => $this->manifest_sha256,
            'created_at' => $this->created_at->toISOString(),
            'intervals' => $this->when(! $request->routeIs('admin.rc-research.annotations.history'), fn () => $this->intervals),
            'effective_intervals' => $this->when($this->legacyLaneChange, fn () => array_map(
                fn (array $item) => $item['movement'] === 'swerving' ? [...$item, 'movement' => 'lane_change'] : $item,
                $this->intervals,
            ))];
    }
}
