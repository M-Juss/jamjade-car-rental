<?php

namespace App\Http\Resources;

use App\Models\CustomerDocument;
use App\Support\PublicStorageUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DocumentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $fileUrl = PublicStorageUrl::make($this->file_path);
        $frontFileUrl = PublicStorageUrl::make($this->front_file_path);
        $backFileUrl = PublicStorageUrl::make($this->back_file_path);
        $user = $this->resource->relationLoaded('user') ? $this->user : null;
        $profile = $user?->relationLoaded('customerProfile') ? $user->customerProfile : null;

        return [
            'id' => $this->id,
            'verificationId' => 'VRF-'.str_pad((string) $this->id, 3, '0', STR_PAD_LEFT),
            'documentType' => $this->document_type,
            'name' => CustomerDocument::labelFor($this->document_type),
            'documentNumber' => $this->document_number,
            'expiresAt' => $this->expires_at?->toDateString(),
            'status' => $this->status->profileLabel(),
            'statusKey' => $this->status->value,
            'fileUrl' => $fileUrl,
            'frontFileUrl' => $frontFileUrl,
            'backFileUrl' => $backFileUrl,
            'fileType' => $fileUrl && str($fileUrl)->lower()->endsWith('.pdf') ? 'pdf' : 'image',
            'submittedAt' => ($this->submitted_at ?? $this->created_at)?->toISOString(),
            'reviewedBy' => $this->reviewer?->name,
            'reviewedAt' => $this->reviewed_at?->toISOString(),
            'rejectionReason' => $this->rejection_reason,
            'customer' => $user ? [
                'name' => $user->name,
                'email' => $user->email,
                'contactNumber' => $user->phone_number,
                'dateOfBirth' => $profile?->birthdate?->format('M j, Y'),
                'age' => $profile?->birthdate?->age,
                'address' => $profile?->address,
            ] : null,
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
