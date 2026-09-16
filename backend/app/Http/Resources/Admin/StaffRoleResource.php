<?php

namespace App\Http\Resources\Admin;

use App\Enums\UserRole;
use App\Services\StaffAccessService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StaffRoleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $access = app(StaffAccessService::class);
        $protected = in_array($this->name, [UserRole::Admin->value, UserRole::Customer->value], true);

        return [
            'id' => $this->id,
            'name' => $this->name,
            'label' => $access->labelForRole($this->name),
            'guardName' => $this->guard_name,
            'modules' => $access->moduleKeysForRole($this->resource),
            'permissions' => $this->permissions->pluck('name')->values(),
            'usersCount' => $this->whenCounted('users'),
            'isProtected' => $protected,
            'canAssign' => ! in_array($this->name, [UserRole::Admin->value, UserRole::Customer->value], true),
            'canEdit' => ! $protected,
            'canDelete' => ! $protected && (int) ($this->users_count ?? 0) === 0,
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
