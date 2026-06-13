<?php

namespace App\Http\Resources\Admin;

use App\Services\AdminAccessService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AdminUserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $access = app(AdminAccessService::class);
        $role = $this->roles->first();
        $isProtected = $this->hasRole('owner');
        [$firstName, $lastName] = $this->splitName((string) $this->name);

        return [
            'id' => $this->id,
            'adminId' => sprintf('ADM-%04d', $this->id),
            'name' => $this->name,
            'firstName' => $firstName,
            'lastName' => $lastName,
            'email' => $this->email,
            'phoneNumber' => $this->phone_number,
            'isActive' => (bool) $this->is_active,
            'status' => $this->is_active ? 'active' : 'inactive',
            'role' => $role ? [
                'id' => $role->id,
                'name' => $role->name,
                'label' => $access->labelForRole($role->name),
                'modules' => $access->moduleKeysForRole($role),
            ] : null,
            'roles' => $this->roles->map(fn ($role) => [
                'id' => $role->id,
                'name' => $role->name,
                'label' => $access->labelForRole($role->name),
            ])->values(),
            'permissions' => $this->getAllPermissions()->pluck('name')->values(),
            'isProtected' => $isProtected,
            'canEdit' => ! $isProtected,
            'canDelete' => ! $isProtected,
            'lastLoginAt' => $this->last_login_at?->toISOString(),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }

    private function splitName(string $name): array
    {
        $parts = preg_split('/\s+/', trim($name), 2) ?: [];

        return [
            $parts[0] ?? '',
            $parts[1] ?? '',
        ];
    }
}
