<?php

namespace App\Http\Resources;

use App\Support\PublicStorageUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'photoUrl' => PublicStorageUrl::make($this->personnel_photo_path),
            'email' => $this->email,
            'phoneNumber' => $this->phone_number,
            'isActive' => (bool) $this->is_active,
            'roles' => $this->whenLoaded('roles', fn () => $this->roles->pluck('name')->values()),
            'permissions' => $this->getAllPermissions()->pluck('name')->values(),
            'lastLoginAt' => $this->last_login_at?->toISOString(),
            'createdAt' => $this->created_at?->toISOString(),
            'profile' => new CustomerProfileResource($this->whenLoaded('customerProfile')),
        ];
    }
}
