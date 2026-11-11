<?php

namespace App\Services;

use App\Enums\DocumentStatus;
use App\Models\CustomerDocument;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class DocumentVerificationService
{
    public function __construct(private readonly NotificationService $notificationService) {}

    /**
     * @param  array{document_type: string, document_number?: string|null, expires_at?: string|null}  $data
     * @param  array{file?: UploadedFile|null, front_file?: UploadedFile|null, back_file?: UploadedFile|null}  $files
     */
    public function upload(User $user, array $data, array $files): CustomerDocument
    {
        $documentType = $data['document_type'];
        $existingDocument = CustomerDocument::withTrashed()
            ->where('user_id', $user->id)
            ->where('document_type', $documentType)
            ->first();

        if ($existingDocument && ! $existingDocument->trashed() && $existingDocument->status === DocumentStatus::Pending) {
            throw ValidationException::withMessages([
                'document_type' => ['This document is pending review. Wait for the review before submitting changes.'],
            ]);
        }

        $storedPaths = [
            'file_path' => $this->storeFile($files['file'] ?? null, $user),
            'front_file_path' => $this->storeFile($files['front_file'] ?? null, $user),
            'back_file_path' => $this->storeFile($files['back_file'] ?? null, $user),
        ];
        $oldPaths = [];

        try {
            $document = DB::transaction(function () use (
                $user,
                $data,
                $documentType,
                &$oldPaths,
                $storedPaths,
            ) {
                User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
                $existingDocument = CustomerDocument::withTrashed()
                    ->where('user_id', $user->id)
                    ->where('document_type', $documentType)
                    ->lockForUpdate()
                    ->first();
                if ($existingDocument && ! $existingDocument->trashed() && $existingDocument->status === DocumentStatus::Pending) {
                    throw ValidationException::withMessages([
                        'document_type' => ['This document is pending review. Wait for the review before submitting changes.'],
                    ]);
                }

                $document = $existingDocument ?? new CustomerDocument([
                    'user_id' => $user->id,
                    'document_type' => $documentType,
                ]);
                $oldPaths = collect([
                    $document->file_path,
                    $document->front_file_path,
                    $document->back_file_path,
                ])->filter()->unique()->all();

                if ($document->trashed()) {
                    $document->restore();
                }

                $document->fill([
                    'document_number' => $data['document_number'] ?? null,
                    'expires_at' => $data['expires_at'] ?? null,
                    'file_path' => $storedPaths['file_path'],
                    'front_file_path' => $storedPaths['front_file_path'],
                    'back_file_path' => $storedPaths['back_file_path'],
                    'status' => DocumentStatus::Pending,
                    'submitted_at' => now(),
                    'reviewed_by' => null,
                    'reviewed_at' => null,
                    'rejection_reason' => null,
                ])->save();

                $this->refreshCustomerSelfDriveStatus($user);

                activity()
                    ->causedBy($user)
                    ->performedOn($document)
                    ->event('document_uploaded')
                    ->withProperties(['document_type' => $documentType])
                    ->log('Customer uploaded a verification document.');

                return $document->fresh(['user.customerProfile', 'reviewer', 'files']);
            });
        } catch (\Throwable $exception) {
            Storage::disk('public')->delete(array_values(array_filter($storedPaths)));

            throw $exception;
        }

        $currentPaths = collect([
            $document->file_path,
            $document->front_file_path,
            $document->back_file_path,
        ])->filter();

        Storage::disk('public')->delete(
            collect($oldPaths)->reject(fn (string $path) => $currentPaths->contains($path))->all()
        );

        return $document;
    }

    public function review(CustomerDocument $document, User $reviewer, DocumentStatus $status, ?string $reason = null): CustomerDocument
    {
        if ($document->status === $status || ($document->status !== DocumentStatus::Pending && ! $reviewer->hasRole('admin'))) {
            throw ValidationException::withMessages([
                'status' => ['Only pending documents can be reviewed.'],
            ]);
        }

        if ($status === DocumentStatus::Rejected && blank($reason)) {
            throw ValidationException::withMessages([
                'rejection_reason' => ['A rejection reason is required when rejecting a document.'],
            ]);
        }

        return DB::transaction(function () use ($document, $reviewer, $status, $reason) {
            $document->update([
                'status' => $status,
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now(),
                'rejection_reason' => $status === DocumentStatus::Rejected ? $reason : null,
            ]);

            $this->refreshCustomerSelfDriveStatus($document->user);
            $label = CustomerDocument::labelFor($document->document_type);

            if ($status === DocumentStatus::Approved) {
                $this->notificationService->createForDocument(
                    $document,
                    "{$label} verification approved",
                    "Approved: Jamjade accepted your {$label}.",
                    [
                        'action_label' => 'View Verification Status',
                        'priority' => 'success',
                        'full_message' => "Status: Approved. Jamjade accepted your {$label}. To use self-drive, make sure all required documents are approved and add an emergency contact in your profile.",
                    ]
                );
            } else {
                $this->notificationService->createForDocument(
                    $document,
                    "{$label} verification not accepted",
                    "Not accepted: {$reason}",
                    [
                        'action' => 'resubmit_document',
                        'action_label' => 'Upload Corrected Document',
                        'priority' => 'warning',
                        'full_message' => "Status: Not accepted. Reason: {$reason} You can now upload a corrected {$label} for another review.",
                        'rejectionReason' => $reason,
                    ]
                );
            }

            activity()
                ->causedBy($reviewer)
                ->performedOn($document)
                ->event('document_reviewed')
                ->withProperties(['status' => $status->value])
                ->log('Customer document reviewed by admin.');

            return $document->fresh(['user.customerProfile', 'reviewer', 'files']);
        });
    }

    private function refreshCustomerSelfDriveStatus(User $user): void
    {
        $requiredDocuments = CustomerDocument::requiredSelfDriveDocumentsFor($user);
        $documents = $user->documents()
            ->whereIn('document_type', $requiredDocuments)
            ->get(['document_type', 'status']);
        $approvedCount = $documents->where('status', DocumentStatus::Approved)->count();
        $hasRejected = $documents->contains('status', DocumentStatus::Rejected);
        $hasPending = $documents->contains('status', DocumentStatus::Pending);

        $profile = $user->customerProfile()->firstOrCreate(['user_id' => $user->id]);

        $profile->update([
            'can_self_drive' => $approvedCount === count($requiredDocuments),
            'verification_status' => match (true) {
                $approvedCount === count($requiredDocuments) => 'approved',
                $hasRejected => 'rejected',
                $hasPending => 'pending_review',
                default => 'documents_required',
            },
        ]);
    }

    private function storeFile(?UploadedFile $file, User $user): ?string
    {
        return $file?->store('customer-documents/'.$user->id, 'public');
    }
}
