<?php

namespace App\Http\Controllers\Web\Admin;

use App\Enums\DocumentStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Document\ListDocumentsRequest;
use App\Http\Requests\Admin\Document\RejectDocumentRequest;
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

    public function index(ListDocumentsRequest $request): JsonResponse
    {
        $status = $request->validated('status');
        $perPage = $request->integer('per_page', 15);

        $documents = CustomerDocument::query()
            ->with(['user.customerProfile', 'reviewer', 'files'])
            ->whereIn('document_type', CustomerDocument::ALLOWED_DOCUMENT_TYPES)
            ->when($status, fn ($query, string $status) => $query->where('status', $status))
            ->latest()
            ->paginate($perPage);

        return $this->paginated('Documents fetched successfully.', $documents, DocumentResource::class);
    }

    public function approve(Request $request, CustomerDocument $document): JsonResponse
    {
        $document = $this->documentService->review($document, $request->user(), DocumentStatus::Approved);

        return $this->success('Document approved successfully.', new DocumentResource($document));
    }

    public function reject(RejectDocumentRequest $request, CustomerDocument $document): JsonResponse
    {
        $document = $this->documentService->review(
            $document,
            $request->user(),
            DocumentStatus::Rejected,
            $request->validated('rejection_reason')
        );

        return $this->success('Document rejected successfully.', new DocumentResource($document));
    }
}
