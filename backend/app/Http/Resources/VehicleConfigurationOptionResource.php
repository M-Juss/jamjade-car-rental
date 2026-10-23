<?php

namespace App\Http\Resources;

use App\Services\VehicleConfigurationService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VehicleConfigurationOptionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id, 'section' => $this->section, 'key' => $this->key,
            'name' => $this->name, 'is_active' => $this->is_active,
            'in_use' => $this->resource->getAttribute('in_use') ?? app(VehicleConfigurationService::class)->usage($this->resource) > 0,
        ];
    }
}
