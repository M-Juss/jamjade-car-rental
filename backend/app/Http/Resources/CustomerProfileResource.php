<?php

namespace App\Http\Resources;

use App\Support\PublicStorageUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        if (! $this->resource) {
            return [];
        }

        $profilePicture = $this->profile_picture;

        return [
            'id' => $this->id,
            'firstName' => $this->first_name,
            'lastName' => $this->last_name,
            'fullName' => trim((string) $this->first_name.' '.(string) $this->last_name),
            'email' => $this->whenLoaded('user', fn () => $this->user->email),
            'phoneNumber' => $this->whenLoaded('user', fn () => $this->user->phone_number),
            'address' => $this->address,
            'addressDetails' => $this->region_code && $this->city_municipality_code && $this->barangay_code
                ? [
                    'countryCode' => $this->country_code ?? 'PH',
                    'regionCode' => $this->region_code,
                    'provinceCode' => $this->province_code,
                    'cityMunicipalityCode' => $this->city_municipality_code,
                    'barangayCode' => $this->barangay_code,
                    'addressLine' => $this->address_line ?? '',
                    'postalCode' => $this->postal_code,
                    'formattedAddress' => $this->address,
                ]
                : null,
            'dateOfBirth' => $this->birthdate?->format('F j, Y'),
            'birthdate' => $this->birthdate?->toDateString(),
            'profilePicture' => PublicStorageUrl::make($profilePicture) ?? '',
            'profileCompletedAt' => $this->profile_completed_at?->toISOString(),
            'emergencyContactSkippedAt' => $this->emergency_contact_skipped_at?->toISOString(),
            'canSelfDrive' => (bool) $this->can_self_drive,
            'verificationStatus' => $this->verification_status,
            'passportRequired' => (bool) $this->passport_required,
            'drivingIntent' => $this->driving_intent,
            'accountStatus' => $this->can_self_drive ? 'Verified' : 'Pending',
            'joinedSince' => $this->created_at?->format('F Y'),
        ];
    }
}
