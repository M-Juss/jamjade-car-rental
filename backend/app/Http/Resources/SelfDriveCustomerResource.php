<?php

namespace App\Http\Resources;

use App\Models\CustomerDocument;
use App\Services\SelfDriveVerificationService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SelfDriveCustomerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $summary = app(SelfDriveVerificationService::class)->summary($this->resource);

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'contactNumber' => $this->phone_number,
            'createdAt' => $this->created_at?->toISOString(),
            ...$summary,
            'documents' => $this->when($request->routeIs('admin.self-drive-verification.show'), fn () => collect(CustomerDocument::requiredSelfDriveDocumentsFor($this->resource))
                ->map(fn (string $type) => [
                    'type' => $type,
                    'document' => $this->documents->firstWhere('document_type', $type)
                        ? new DocumentResource($this->documents->firstWhere('document_type', $type))
                        : null,
                ])->values()),
        ];
    }
}
