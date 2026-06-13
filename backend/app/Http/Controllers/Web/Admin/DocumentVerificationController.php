<?php

namespace App\Http\Controllers\Web\Admin;

use App\Enums\DocumentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\DocumentResource;
use App\Models\CustomerDocument;
use App\Services\DocumentVerificationService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DocumentVerificationController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly DocumentVerificationService $documentService) {}

    public function index(Request $request): JsonResponse
    {
        $documents = CustomerDocument::query()
            ->with(['user.customerProfile', 'reviewer'])
            ->whereIn('document_type', CustomerDocument::ALLOWED_DOCUMENT_TYPES)
            ->when($request->string('status')->toString(), fn ($query, string $status) => $query->where('status', $status))
            ->latest()
            ->paginate((int) $request->integer('per_page', 15));

        return $this->paginated('Documents fetched successfully.', $documents, DocumentResource::class);
    }

    public function approve(Request $request, CustomerDocument $document): JsonResponse
    {
        $document = $this->documentService->review($document, $request->user(), DocumentStatus::Approved);

        return $this->success('Document approved successfully.', new DocumentResource($document));
    }

    public function reject(Request $request, CustomerDocument $document): JsonResponse
    {
        $validated = $request->validate([
            'rejection_reason' => ['required', 'string', 'max:1000'],
        ]);

        $document = $this->documentService->review(
            $document,
            $request->user(),
            DocumentStatus::Rejected,
            $validated['rejection_reason']
        );

        return $this->success('Document rejected successfully.', new DocumentResource($document));
    }
}
