<?php

namespace App\Services;

use App\Enums\AdditionalChargeResponsibility;
use App\Enums\BookingStatus;
use App\Models\Booking;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PersonnelService
{
    public function __construct(private readonly AdditionalChargeService $charges) {}

    public function accounts(array $filters, User $actor): LengthAwarePaginator
    {
        return $this->query($actor)
            ->with('roles')
            ->when($filters['search'] ?? null, function (Builder $query, string $search) {
                $query->where(function (Builder $query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('phone_number', 'like', "%{$search}%");
                });
            })
            ->when(($filters['status'] ?? 'all') !== 'all', fn (Builder $query) => $query->where('is_active', $filters['status'] === 'active'))
            ->when(($filters['role'] ?? 'all') !== 'all', fn (Builder $query) => $query->role($filters['role']))
            ->latest('id')
            ->paginate($filters['per_page'] ?? 20);
    }

    public function summary(User $actor): array
    {
        return [
            'total' => $this->query($actor)->count(),
            'active' => $this->query($actor)->where('is_active', true)->count(),
            'staff' => $this->query($actor)->role('staff')->count(),
            'drivers' => $this->query($actor)->role('driver')->count(),
        ];
    }

    public function create(array $data, User $actor): User
    {
        abort_unless($this->canManageRole($actor, $data['role'] ?? ''), 403);
        abort_unless(in_array($data['role'] ?? null, ['staff', 'driver', 'admin'], true), 422);

        return DB::transaction(function () use ($data, $actor) {
            $user = User::create([
                ...$this->accountFields($data),
                'password' => $data['password'],
                'email_verified_at' => now(),
                'is_active' => $data['is_active'] ?? true,
            ]);
            $user->syncRoles([$data['role']]);

            activity()->causedBy($actor)->performedOn($user)->event('personnel_created')
                ->withProperties(['role' => $data['role'], 'is_active' => $user->is_active])
                ->log('Personnel account created.');

            return $user->load('roles');
        });
    }

    public function update(User $account, array $data, User $actor): User
    {
        return DB::transaction(function () use ($account, $data, $actor) {
            $user = User::query()->lockForUpdate()->findOrFail($account->id);

            if ($user->roles()->count() !== 1 || ! $this->canManageRole($actor, $user->roles()->first()->name) || ! $this->canManageRole($actor, $data['role']) || ($user->hasRole('admin') && $data['role'] !== 'admin') || (! $user->hasRole('admin') && $data['role'] === 'admin')) {
                throw ValidationException::withMessages([
                    'role' => ['Only Staff and Driver accounts can be updated here.'],
                ]);
            }

            $roleChanged = ! $user->hasRole($data['role']);
            $isActive = $data['is_active'] ?? $user->is_active;

            if ($roleChanged || ($user->is_active && ! $isActive)) {
                $field = $roleChanged ? 'role' : 'is_active';
                $hasAssignment = Booking::query()
                    ->whereHas('assignment', fn (Builder $query) => $query->where('driver_id', $user->id))
                    ->whereIn('status', [BookingStatus::Pending, BookingStatus::Confirmed, BookingStatus::Ongoing])
                    ->exists();

                if ($hasAssignment) {
                    throw ValidationException::withMessages([
                        $field => ['Reassign pending or confirmed services and finish ongoing services before changing this Driver\'s role or deactivating the account.'],
                    ]);
                }

                if ($this->charges->hasOutstanding($user, AdditionalChargeResponsibility::Driver)) {
                    throw ValidationException::withMessages([
                        $field => ['Settle outstanding Driver charges before changing the role or deactivating the account.'],
                    ]);
                }
            }

            $fields = [...$this->accountFields($data), 'is_active' => $isActive];

            if (! empty($data['password'])) {
                $fields['password'] = $data['password'];
            }

            if ($roleChanged || ! $isActive || ! empty($data['password'])) {
                $user->tokens()->delete();
                $fields['remember_token'] = Str::random(60);
            }

            $user->forceFill($fields);
            $changedFields = array_keys($user->getDirty());
            $user->save();
            $user->syncRoles([$data['role']]);

            if ($roleChanged) {
                $user->syncPermissions([]);
            }

            activity()->causedBy($actor)->performedOn($user)->event('personnel_updated')
                ->withProperties([
                    'role' => $data['role'],
                    'role_changed' => $roleChanged,
                    'is_active' => $user->is_active,
                    'changed_fields' => array_values(array_diff($changedFields, ['password', 'remember_token'])),
                    'password_changed' => ! empty($data['password']),
                ])->log('Personnel account updated.');

            return $user->fresh()->load('roles');
        });
    }

    public function delete(User $account, User $actor): void
    {
        DB::transaction(function () use ($account, $actor) {
            $user = User::query()->lockForUpdate()->findOrFail($account->id);

            if ($user->roles()->count() !== 1 || ! $this->canManageRole($actor, $user->roles()->first()->name)) {
                throw ValidationException::withMessages([
                    'personnel' => ['Only Staff and Driver accounts can be deleted.'],
                ]);
            }

            $hasAssignment = Booking::query()
                ->whereHas('assignment', fn (Builder $query) => $query->where('driver_id', $user->id))
                ->whereIn('status', [BookingStatus::Pending, BookingStatus::Confirmed, BookingStatus::Ongoing])
                ->exists();

            if ($hasAssignment) {
                throw ValidationException::withMessages([
                    'personnel' => ['Reassign pending or confirmed services and finish ongoing services before deleting this account.'],
                ]);
            }

            if ($this->charges->hasOutstanding($user, AdditionalChargeResponsibility::Driver)) {
                throw ValidationException::withMessages([
                    'personnel' => ['Settle outstanding Driver charges before deleting this account.'],
                ]);
            }

            $role = $user->roles()->sole()->name;
            $user->tokens()->delete();
            $user->forceFill(['is_active' => false, 'remember_token' => Str::random(60)])->save();
            $user->delete();

            activity()->causedBy($actor)->performedOn($user)->event('personnel_deleted')
                ->withProperties(['role' => $role])
                ->log('Personnel account soft deleted.');
        });
    }

    private function query(User $actor): Builder
    {
        return User::query()->role($actor->hasRole('owner') ? ['staff', 'driver', 'admin'] : ['staff', 'driver'])->has('roles', '=', 1);
    }

    private function canManageRole(User $actor, string $role): bool
    {
        return match ($role) {
            'admin' => $actor->hasRole('owner'),
            'staff' => $actor->hasRole('admin'),
            'driver' => $actor->hasAnyRole(['admin', 'staff']),
            default => false,
        };
    }

    private function accountFields(array $data): array
    {
        return [
            'name' => trim($data['first_name'].' '.$data['last_name']),
            'email' => $data['email'],
            'phone_number' => $data['phone_number'] ?? null,
        ];
    }
}
