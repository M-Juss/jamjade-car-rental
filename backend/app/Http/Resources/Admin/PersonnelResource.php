<?php

namespace App\Http\Resources\Admin;

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
            'firstName' => $parts[0] ?? '',
            'lastName' => $parts[1] ?? '',
            'email' => $this->email,
            'phoneNumber' => $this->phone_number,
            'isActive' => (bool) $this->is_active,
            'status' => $this->is_active ? 'active' : 'inactive',
            'role' => ['name' => $category, 'label' => ucfirst($category)],
            'lastLoginAt' => $this->last_login_at?->toISOString(),
        ];
    }
}
