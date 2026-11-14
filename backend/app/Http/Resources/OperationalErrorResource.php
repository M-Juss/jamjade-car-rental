<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

class OperationalErrorResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'createdAt' => Carbon::parse($this->created_at)->toISOString(),
            'performedBy' => $this->actor,
            'module' => $this->module,
            'action' => $this->action,
            'message' => $this->message,
            'status' => $this->status,
        ];
    }
}
