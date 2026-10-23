<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RcResearchSessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'name' => $this->name, 'phone_model' => $this->phone_model,
            'rc_model' => $this->rc_model, 'surface' => $this->surface, 'slope' => $this->slope,
            'mount_orientation' => $this->mount_orientation, 'mount_method' => $this->mount_method,
            'battery_condition' => $this->battery_condition, 'rc_configuration' => $this->rc_configuration,
            'platform' => $this->platform, 'app_version' => $this->app_version, 'added_load_g' => $this->added_load_g,
            'protocol' => $this->protocol, 'created_at' => $this->created_at?->toISOString()];
    }
}
