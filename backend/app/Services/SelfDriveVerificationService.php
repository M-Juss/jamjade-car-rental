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

    public function filterCustomers(Builder $query, ?string $status): Builder
    {
        return match ($status) {
            'eligible' => $this->eligibleCustomers($query),
            'not_eligible' => $query->whereNotIn('users.id', $this->eligibleCustomers(User::role('customer')->select('users.id'))),
            'no_documents' => $query->whereDoesntHave('documents', $this->requiredDocuments(...)),
            'pending_review' => $query->whereExists($this->pendingReviewDocuments()),
            'incomplete' => $query
                ->whereHas('documents', $this->requiredDocuments(...), '<', count(CustomerDocument::REQUIRED_SELF_DRIVE_DOCUMENTS))
                ->whereHas('documents', fn (Builder $documents) => $this->requiredDocuments($documents)
                    ->where('status', DocumentStatus::Approved->value))
                ->whereDoesntHave('documents', fn (Builder $documents) => $this->requiredDocuments($documents)
                    ->where('status', '!=', DocumentStatus::Approved->value)),
            default => $query,
        };
    }

    public function prioritizePendingReview(Builder $query): Builder
    {
        return $query->orderByDesc($this->pendingReviewDocuments()->limit(1));
    }

    private function requiredDocuments(Builder $documents): Builder
    {
        return $documents->whereIn('document_type', CustomerDocument::REQUIRED_SELF_DRIVE_DOCUMENTS);
    }

    private function pendingReviewDocuments(): Builder
    {
        // Rejected required documents take precedence over pending documents in summary().
        return $this->requiredDocuments(CustomerDocument::query())
            ->selectRaw('1')
            ->whereColumn('customer_documents.user_id', 'users.id')
            ->where('status', DocumentStatus::Pending->value)
            ->whereNotIn('user_id', $this->requiredDocuments(CustomerDocument::query())
                ->select('user_id')
                ->where('status', DocumentStatus::Rejected->value));
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
