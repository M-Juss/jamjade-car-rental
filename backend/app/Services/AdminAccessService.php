<?php

namespace App\Services;

use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class AdminAccessService
{
    public function modules(bool $assignableOnly = false): Collection
    {
        return collect(config('admin_modules'))
            ->map(fn (array $module, string $key) => [
                'key' => $key,
                'label' => $module['label'],
                'description' => $module['description'],
                'permission' => $module['permission'],
                'adminPath' => $module['admin_path'],
                'ownerPath' => $module['owner_path'],
                'assignable' => (bool) ($module['assignable'] ?? true),
                'ownerOnly' => (bool) ($module['owner_only'] ?? false),
            ])
            ->when($assignableOnly, fn (Collection $modules) => $modules->where('assignable', true))
            ->values();
    }

    public function assignableModuleKeys(): array
    {
        return $this->modules(assignableOnly: true)
            ->pluck('key')
            ->all();
    }

    public function moduleKeysForRole(Role $role): array
    {
        $rolePermissions = $role->permissions->pluck('name')->all();

        return $this->modules()
            ->filter(fn (array $module) => in_array($module['permission'], $rolePermissions, true))
            ->pluck('key')
            ->values()
            ->all();
    }

    public function permissionNamesForModuleKeys(array $moduleKeys): array
    {
        $selected = collect($moduleKeys)->unique()->values();

        return $this->modules(assignableOnly: true)
            ->whereIn('key', $selected)
            ->pluck('permission')
            ->values()
            ->all();
    }

    public function syncRoleModules(Role $role, array $moduleKeys): void
    {
        $permissions = $this->permissionNamesForModuleKeys($moduleKeys);

        collect($permissions)->each(
            fn (string $permission) => Permission::findOrCreate($permission, $role->guard_name)
        );

        $role->syncPermissions($permissions);
        $role->load('permissions');
    }

    public function normalizeRoleName(string $name): string
    {
        return Str::of($name)
            ->trim()
            ->lower()
            ->replaceMatches('/[^a-z0-9\s_-]/', '')
            ->replaceMatches('/[\s-]+/', '_')
            ->trim('_')
            ->toString();
    }

    public function labelForRole(string $name): string
    {
        return Str::of($name)
            ->replace('_', ' ')
            ->title()
            ->toString();
    }
}
