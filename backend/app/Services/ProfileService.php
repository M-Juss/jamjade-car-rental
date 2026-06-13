<?php

namespace App\Services;

use App\Models\EmergencyContact;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProfileService
{
    public function complete(User $user, array $data, ?UploadedFile $profilePicture = null)
    {
        return DB::transaction(function () use ($user, $data, $profilePicture) {
            $profile = $user->customerProfile()->firstOrCreate(['user_id' => $user->id]);

            if (isset($data['phone_number'])) {
                $user->forceFill(['phone_number' => $data['phone_number']])->save();
            }

            $firstName = $data['first_name'] ?? $profile->first_name;
            $lastName = $data['last_name'] ?? $profile->last_name;
            $birthdateValue = $data['birthdate'] ?? $profile->birthdate?->toDateString();
            $address = $data['address'] ?? $profile->address;

            $missingFields = collect([
                'first_name' => $firstName,
                'last_name' => $lastName,
                'birthdate' => $birthdateValue,
                'address' => $address,
                'phone_number' => $user->phone_number,
            ])->filter(fn ($value) => blank($value))
                ->mapWithKeys(fn ($value, string $field) => [
                    $field => ['This field is required before completing the profile.'],
                ])
                ->all();

            if ($missingFields !== []) {
                throw ValidationException::withMessages($missingFields);
            }

            $birthdate = CarbonImmutable::parse($birthdateValue);
            $wantsSelfDrive = (bool) ($data['wants_self_drive'] ?? false);
            $drivingIntent = $data['driving_intent']
                ?? ($wantsSelfDrive ? 'self_drive' : $profile->driving_intent);

            if ($drivingIntent === 'self_drive' && $birthdate->age < 18) {
                throw ValidationException::withMessages([
                    'birthdate' => ['Self-drive rental is only available for customers who are 18 years old and above.'],
                ]);
            }

            if ($birthdate->age < 18) {
                $drivingIntent = 'owner_driver';
            } elseif (! $drivingIntent) {
                throw ValidationException::withMessages([
                    'driving_intent' => ['Choose a driving option before completing the profile.'],
                ]);
            }

            $picturePath = $profilePicture?->store('profiles', 'public');

            $profile->fill([
                'first_name' => $firstName,
                'last_name' => $lastName,
                'birthdate' => $birthdate->toDateString(),
                'address' => $address,
                'profile_picture' => $picturePath ?? $profile->profile_picture,
                'profile_completed_at' => now(),
                'driving_intent' => $drivingIntent,
                'verification_status' => $drivingIntent === 'self_drive'
                    ? 'documents_required'
                    : 'owner_driver_ready',
            ])->save();

            $user->forceFill([
                'name' => trim($firstName.' '.$lastName),
            ])->save();

            activity()
                ->causedBy($user)
                ->performedOn($profile)
                ->event('profile_completed')
                ->log('Customer completed their mobile profile.');

            return $profile->load('user');
        });
    }

    public function update(User $user, array $data, ?UploadedFile $profilePicture = null)
    {
        return DB::transaction(function () use ($user, $data, $profilePicture) {
            if (isset($data['phone_number'])) {
                $user->forceFill(['phone_number' => $data['phone_number']])->save();
            }

            $profile = $user->customerProfile()->firstOrCreate(['user_id' => $user->id]);
            $profileData = collect($data)
                ->only(['first_name', 'last_name', 'birthdate', 'address'])
                ->filter(fn ($value) => $value !== null)
                ->all();

            if ($profilePicture) {
                $profileData['profile_picture'] = $profilePicture->store('profiles', 'public');
            }

            if ($profileData !== []) {
                $profile->fill($profileData)->save();
            }

            if ($profile->first_name && $profile->last_name) {
                $user->forceFill([
                    'name' => trim($profile->first_name.' '.$profile->last_name),
                ])->save();
            }

            return $profile->fresh('user');
        });
    }

    public function saveEmergencyContact(User $user, array $data): EmergencyContact
    {
        $contact = EmergencyContact::updateOrCreate(
            ['user_id' => $user->id],
            [
                'name' => $data['name'],
                'relationship' => $data['relationship'],
                'phone_number' => $data['phone_number'],
            ]
        );

        $user->customerProfile()->firstOrCreate(['user_id' => $user->id])
            ->update(['emergency_contact_skipped_at' => null]);

        return $contact;
    }

    public function skipEmergencyContact(User $user): void
    {
        $user->customerProfile()->firstOrCreate(['user_id' => $user->id])
            ->update(['emergency_contact_skipped_at' => now()]);
    }

    public function isSelfDriveEligible(User $user): bool
    {
        $profile = $user->customerProfile;

        if (! $profile || ! $profile->birthdate || $profile->birthdate->age < 18) {
            return false;
        }

        return (bool) $profile->can_self_drive;
    }
}
