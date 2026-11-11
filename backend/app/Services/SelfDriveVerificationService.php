<?php

namespace App\Services;

use App\Enums\DocumentStatus;
use App\Models\CustomerDocument;
use App\Models\User;
use App\Support\CustomerAgePolicy;
use Illuminate\Database\Eloquent\Builder;

class SelfDriveVerificationService
{
    public function eligibleCustomers(Builder $query): Builder
    {
        return $query
            ->whereHas('customerProfile', fn (Builder $profile) => $profile
                ->whereDate('birthdate', '<=', CustomerAgePolicy::latestEligibleBirthdate()))
            ->whereHas('completeEmergencyContacts')
            ->whereHas('documents', fn (Builder $documents) => $documents
                ->where('document_type', CustomerDocument::DRIVERS_LICENSE)
                ->where('status', DocumentStatus::Approved->value))
            ->whereHas('documents', fn (Builder $documents) => $documents
                ->where('document_type', CustomerDocument::PROOF_OF_BILLING)
                ->where('status', DocumentStatus::Approved->value));
    }

    public function summary(User $customer): array
    {
        $customer->loadMissing(['customerProfile', 'documents']);
        $required = CustomerDocument::requiredSelfDriveDocumentsFor($customer);
        $documents = $customer->documents->keyBy('document_type');
        $counts = ['approved' => 0, 'pending' => 0, 'rejected' => 0, 'missing' => 0];

        foreach ($required as $type) {
            $status = $documents->get($type)?->status;
            $key = $status instanceof DocumentStatus ? $status->value : 'missing';
            $counts[$key]++;
        }

        $ageEligible = CustomerAgePolicy::isEligible($customer->customerProfile?->birthdate);
        $documentsApproved = $counts['approved'] === count($required);
        $canSelfDrive = $ageEligible && $documentsApproved && $customer->hasCompleteEmergencyContact();

        return [
            'canSelfDrive' => $canSelfDrive,
            'reviewStatus' => match (true) {
                $canSelfDrive => 'eligible',
                $counts['rejected'] > 0 => 'needs_correction',
                $counts['pending'] > 0 => 'pending_review',
                $counts['missing'] > 0 => 'documents_required',
                ! $ageEligible => 'age_ineligible',
                $documentsApproved => 'emergency_contact_required',
                default => 'documents_required',
            },
            'ageEligible' => $ageEligible,
            'requiredDocumentCount' => count($required),
            'documentCounts' => $counts,
        ];
    }
}
