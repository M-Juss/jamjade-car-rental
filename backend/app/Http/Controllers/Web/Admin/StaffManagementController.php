<?php

namespace App\Http\Controllers\Web\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StaffManagement\ListStaffUsersRequest;
use App\Http\Requests\Admin\StaffManagement\StoreStaffRoleRequest;
use App\Http\Requests\Admin\StaffManagement\StoreStaffUserRequest;
use App\Http\Requests\Admin\StaffManagement\UpdateStaffRoleRequest;
use App\Http\Requests\Admin\StaffManagement\UpdateStaffUserRequest;
use App\Http\Resources\Admin\StaffRoleResource;
use App\Http\Resources\Admin\StaffUserResource;
use App\Models\User;
use App\Services\StaffAccessService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class StaffManagementController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly StaffAccessService $access) {}

    public function index(ListStaffUsersRequest $request): JsonResponse
    {
        $filters = $request->validated();

        $users = $this->staffUserQuery()
            ->when($filters['search'] ?? null, function ($query, string $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('phone_number', 'like', "%{$search}%");
                });
            })
            ->when(($filters['status'] ?? 'all') !== 'all', function ($query) use ($filters) {
                $query->where('is_active', $filters['status'] === 'active');
            })
            ->when(($filters['role'] ?? 'all') !== 'all', function ($query) use ($filters) {
                $query->role($filters['role']);
            })
            ->latest()
            ->get();

        $roles = $this->staffRolesQuery()
            ->with('permissions')
            ->withCount('users')
            ->orderByRaw("CASE name WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'staff' THEN 2 ELSE 3 END")
            ->orderBy('name')
            ->get();

        return $this->success('Staff management fetched successfully.', [
            'summary' => [
                'total' => $users->count(),
                'active' => $users->where('is_active', true)->count(),
                'inactive' => $users->where('is_active', false)->count(),
                'roles' => $roles->count(),
            ],
            'users' => StaffUserResource::collection($users),
            'roles' => StaffRoleResource::collection($roles),
            'modules' => $this->access->modules(),
        ]);
    }

    public function modules(): JsonResponse
    {
        return $this->success('Staff modules fetched successfully.', [
            'modules' => $this->access->modules(),
        ]);
    }

    public function roles(): JsonResponse
    {
        $roles = $this->staffRolesQuery()
            ->with('permissions')
            ->withCount('users')
            ->orderBy('name')
            ->get();

        return $this->success('Staff roles fetched successfully.', [
            'roles' => StaffRoleResource::collection($roles),
        ]);
    }

    public function storeRole(StoreStaffRoleRequest $request): JsonResponse
    {
        $name = $this->access->normalizeRoleName($request->string('name')->toString());

        $this->ensureRoleNameIsAllowed($name);
        $this->ensureRoleNameIsAvailable($name);

        $role = DB::transaction(function () use ($name, $request) {
            $role = Role::create([
                'name' => $name,
                'guard_name' => 'web',
            ]);

            $this->access->syncRoleModules($role, $request->validated('modules'));
            app(PermissionRegistrar::class)->forgetCachedPermissions();

            return $role->load('permissions')->loadCount('users');
        });

        return $this->created('Staff role created successfully.', [
            'role' => new StaffRoleResource($role),
        ]);
    }

    public function updateRole(UpdateStaffRoleRequest $request, Role $role): JsonResponse
    {
        $this->ensureRoleCanBeChanged($role);

        DB::transaction(function () use ($request, $role) {
            if ($request->filled('name')) {
                $name = $this->access->normalizeRoleName($request->string('name')->toString());

                if ($name !== $role->name) {
                    $this->ensureRoleNameIsAllowed($name);
                    $this->ensureRoleNameIsAvailable($name);
                    $role->forceFill(['name' => $name])->save();
                }
            }

            $this->access->syncRoleModules($role, $request->validated('modules'));
            app(PermissionRegistrar::class)->forgetCachedPermissions();
        });

        return $this->success('Staff role updated successfully.', [
            'role' => new StaffRoleResource($role->fresh()->load('permissions')->loadCount('users')),
        ]);
    }

    public function destroyRole(Role $role): JsonResponse
    {
        $this->ensureRoleCanBeChanged($role);

        if ($role->users()->exists()) {
            throw ValidationException::withMessages([
                'role' => ['Move users off this role before deleting it.'],
            ]);
        }

        $role->delete();
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return $this->noData('Staff role deleted successfully.');
    }

    public function storeUser(StoreStaffUserRequest $request): JsonResponse
    {
        $this->ensureAssignableRole($request->validated('role'));

        $user = DB::transaction(function () use ($request) {
            $data = $request->validated();

            $user = User::create([
                'name' => $this->nameFromRequest($data),
                'email' => $data['email'],
                'phone_number' => $data['phone_number'] ?? null,
                'password' => $data['password'],
                'email_verified_at' => now(),
                'is_active' => $data['is_active'] ?? true,
            ]);

            $user->syncRoles([$data['role']]);

            return $user->load(['roles.permissions']);
        });

        return $this->created('Staff account created successfully.', [
            'user' => new StaffUserResource($user),
        ]);
    }

    public function updateUser(UpdateStaffUserRequest $request, User $user): JsonResponse
    {
        $this->ensureUserCanBeChanged($request, $user);
        $this->ensureAssignableRole($request->validated('role'));

        DB::transaction(function () use ($request, $user) {
            $data = $request->validated();
            $payload = [
                'name' => $this->nameFromRequest($data),
                'email' => $data['email'],
                'phone_number' => $data['phone_number'] ?? null,
                'is_active' => $data['is_active'] ?? true,
            ];

            if (! empty($data['password'])) {
                $payload['password'] = $data['password'];
            }

            $user->forceFill($payload)->save();
            $user->syncRoles([$data['role']]);
        });

        return $this->success('Staff account updated successfully.', [
            'user' => new StaffUserResource($user->fresh()->load(['roles.permissions'])),
        ]);
    }

    public function destroyUser(Request $request, User $user): JsonResponse
    {
        $this->ensureUserCanBeChanged($request, $user);
        $user->delete();

        return $this->noData('Staff account deleted successfully.');
    }

    private function staffUserQuery()
    {
        $roleNames = $this->staffRolesQuery()->pluck('name');

        return User::query()
            ->with(['roles.permissions'])
            ->whereHas('roles', fn ($query) => $query->whereIn('name', $roleNames));
    }

    private function staffRolesQuery()
    {
        return Role::query()
            ->where('guard_name', 'web')
            ->whereNotIn('name', [
                UserRole::Owner->value,
                UserRole::Customer->value,
            ]);
    }

    private function nameFromRequest(array $data): string
    {
        if (! empty($data['name'])) {
            return trim($data['name']);
        }

        return trim(collect([$data['first_name'] ?? '', $data['last_name'] ?? ''])->filter()->implode(' '));
    }

    private function ensureAssignableRole(string $role): void
    {
        if (in_array($role, [UserRole::Owner->value, UserRole::Customer->value], true)) {
            throw ValidationException::withMessages([
                'role' => ['This role cannot be assigned from staff management.'],
            ]);
        }
    }

    private function ensureRoleCanBeChanged(Role $role): void
    {
        if (in_array($role->name, [UserRole::Owner->value, UserRole::Customer->value], true)) {
            throw ValidationException::withMessages([
                'role' => ['This protected role cannot be changed.'],
            ]);
        }
    }

    private function ensureRoleNameIsAllowed(string $name): void
    {
        if ($name === '' || in_array($name, [UserRole::Owner->value, UserRole::Customer->value], true)) {
            throw ValidationException::withMessages([
                'name' => ['Choose a different role name.'],
            ]);
        }
    }

    private function ensureRoleNameIsAvailable(string $name): void
    {
        if (Role::query()->where('guard_name', 'web')->where('name', $name)->exists()) {
            throw ValidationException::withMessages([
                'name' => ['A role with this name already exists.'],
            ]);
        }
    }

    private function ensureUserCanBeChanged(Request $request, User $user): void
    {
        if ($request->user()?->is($user)) {
            throw ValidationException::withMessages([
                'user' => ['You cannot modify your own owner account here.'],
            ]);
        }

        if ($user->hasRole(UserRole::Owner->value)) {
            throw ValidationException::withMessages([
                'user' => ['Owner accounts are protected from staff management changes.'],
            ]);
        }
    }
}
