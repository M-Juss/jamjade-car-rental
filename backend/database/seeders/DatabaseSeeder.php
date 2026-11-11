<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            RoleAndPermissionSeeder::class,
        ]);

        User::query()
            ->whereIn('email', ['admin@jamjade.test', 'test@example.com'])
            ->delete();

        $ownerEmail = 'jamjade.carrentalofficial@gmail.com';
        $legacyOwnerEmails = [
            'jamjadecarrental@gmail.com',
            'jamjadecarental@gmail.com',
        ];
        $ownerPhone = '09170000002';
        $owner = User::query()->where('email', $ownerEmail)->first();
        $legacyOwners = User::query()->whereIn('email', $legacyOwnerEmails)->get();
        $phoneOwner = User::query()->where('phone_number', $ownerPhone)->first();

        $owner ??= $legacyOwners->first() ?? $phoneOwner ?? new User;

        foreach ($legacyOwners as $legacyOwner) {
            if (! $legacyOwner->is($owner)) {
                $legacyOwner->delete();
            }
        }

        if ($phoneOwner && ! $phoneOwner->is($owner)) {
            $phoneOwner->forceFill(['phone_number' => null])->save();
        }

        $owner->forceFill([
            'name' => 'Jamjade Owner',
            'email' => $ownerEmail,
            'phone_number' => $ownerPhone,
            'password' => Hash::make('Jamjade@123'),
            'email_verified_at' => now(),
            'is_active' => true,
        ])->save();
        $owner->syncRoles([UserRole::Admin->value, UserRole::Owner->value]);
    }
}
