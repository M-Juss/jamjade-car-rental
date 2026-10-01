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

    public function accounts(array $filters): LengthAwarePaginator
    {
        return $this->query()
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

    public function summary(): array
    {
        return [
            'total' => $this->query()->count(),
            'active' => $this->query()->where('is_active', true)->count(),
            'staff' => $this->query()->role('staff')->count(),
            'drivers' => $this->query()->role('driver')->count(),
        ];
    }

    public function create(array $data): User
    {
        return DB::transaction(function () use ($data) {
            $user = User::create([
                ...$this->accountFields($data),
                'password' => $data['password'],
                'email_verified_at' => now(),
                'is_active' => $data['is_active'] ?? true,
            ]);
            $user->syncRoles([$data['role']]);

            return $user->load('roles');
        });
    }

    public function update(User $account, array $data): User
    {
        return DB::transaction(function () use ($account, $data) {
            $user = User::query()->lockForUpdate()->findOrFail($account->id);

            if ($user->roles()->count() !== 1 || ! $user->hasAnyRole(['staff', 'driver'])) {
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

            $user->forceFill($fields)->save();
            $user->syncRoles([$data['role']]);

            if ($roleChanged) {
                $user->syncPermissions([]);
            }

            return $user->fresh()->load('roles');
        });
    }

    private function query(): Builder
    {
        return User::query()->role(['staff', 'driver'])->has('roles', '=', 1);
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
