<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Enums\AdditionalChargeResponsibility;
use App\Enums\BookingStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Profile\CompleteProfileRequest;
use App\Http\Requests\Profile\EmergencyContactRequest;
use App\Http\Requests\Profile\UpdateProfileRequest;
use App\Http\Resources\CustomerProfileResource;
use App\Http\Resources\DocumentResource;
use App\Http\Resources\UserResource;
use App\Models\CustomerDocument;
use App\Services\AdditionalChargeService;
use App\Services\ProfileService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        private readonly ProfileService $profileService,
        private readonly AdditionalChargeService $additionalChargeService,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $user = $request->user()->load(['customerProfile.user', 'documents.reviewer', 'emergencyContacts', 'roles']);
        $successfulBookings = $user->bookings()
            ->where('status', BookingStatus::Completed)
            ->count();
        $totalSpent = (float) $user->bookings()
            ->where('status', BookingStatus::Completed)
            ->sum('total_amount');
        $currentBooking = $user->bookings()
            ->whereIn('status', [
                BookingStatus::Pending->value,
                BookingStatus::Confirmed->value,
                BookingStatus::Ongoing->value,
                BookingStatus::Returned->value,
            ])
            ->latest()
            ->first();
        $bookingStatus = match ($currentBooking?->status) {
            BookingStatus::Ongoing => 'ongoing',
            BookingStatus::Returned => 'returned',
            BookingStatus::Pending, BookingStatus::Confirmed => 'pending',
            default => 'none',
        };
        $hasOutstandingBalance = $this->additionalChargeService->hasOutstanding(
            $user,
            AdditionalChargeResponsibility::Customer,
        );

        return $this->success('Profile fetched successfully.', [
            'user' => new UserResource($user),
            'profile' => new CustomerProfileResource($user->customerProfile),
            'documents' => DocumentResource::collection($user->documents),
            'emergencyContacts' => $user->emergencyContacts,
            'selfDriveAvailability' => [
                'canSelfDrive' => $this->profileService->isSelfDriveEligible($user),
                'requiredDocuments' => collect(CustomerDocument::requiredSelfDriveDocumentsFor($user))
                    ->map(fn (string $type) => [
                        'documentType' => $type,
                        'name' => CustomerDocument::labelFor($type),
                    ])
                    ->values(),
            ],
            'bookingSummary' => [
                'status' => $bookingStatus,
                'successfulBookings' => $successfulBookings,
                'totalSpent' => $totalSpent,
                'hasOutstandingBalance' => $hasOutstandingBalance,
            ],
        ]);
    }

    public function complete(CompleteProfileRequest $request): JsonResponse
    {
        $profile = $this->profileService->complete(
            $request->user(),
            $request->validated(),
            $request->file('profile_picture')
        );

        return $this->success('Profile completed successfully.', new CustomerProfileResource($profile));
    }

    public function update(UpdateProfileRequest $request): JsonResponse
    {
        $profile = $this->profileService->update(
            $request->user(),
            $request->validated(),
            $request->file('profile_picture')
        );

        return $this->success('Profile updated successfully.', new CustomerProfileResource($profile));
    }

    public function emergencyContact(EmergencyContactRequest $request): JsonResponse
    {
        $contact = $this->profileService->saveEmergencyContact($request->user(), $request->validated());

        return $this->success('Emergency contact saved successfully.', $contact);
    }

    public function skipEmergencyContact(Request $request): JsonResponse
    {
        $this->profileService->skipEmergencyContact($request->user());

        return $this->noData('Emergency contact skipped for now.');
    }
}
