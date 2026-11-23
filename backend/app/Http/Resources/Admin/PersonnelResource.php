<?php

namespace App\Http\Resources\Admin;

use App\Support\PublicStorageUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PersonnelResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $category = $this->roles->first()->name;
        $parts = preg_split('/\s+/', trim((string) $this->name), 2) ?: [];

        return [
            'id' => $this->id,
            'personnelId' => sprintf('PER-%04d', $this->id),
            'category' => $category,
            'name' => $this->name,
            'photoUrl' => PublicStorageUrl::make($this->personnel_photo_path),
            'firstName' => $parts[0] ?? '',
            'lastName' => $parts[1] ?? '',
            'email' => $this->email,
            'phoneNumber' => $this->phone_number,
            'isActive' => (bool) $this->is_active,
            'availableNow' => $category === 'driver' ? (bool) ($this->is_active && preg_match('/^09\d{9}$/', (string) $this->phone_number) && ! $this->has_ongoing_service) : null,
            'status' => $this->is_active ? 'active' : 'inactive',
            'role' => ['name' => $category, 'label' => ucfirst($category)],
            'lastLoginAt' => $this->last_login_at?->toISOString(),
        ];
    }
}
