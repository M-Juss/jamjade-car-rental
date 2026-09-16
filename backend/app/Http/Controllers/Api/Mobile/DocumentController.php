<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\Document\UploadDocumentRequest;
use App\Http\Resources\DocumentResource;
use App\Models\CustomerDocument;
use App\Services\DocumentVerificationService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DocumentController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly DocumentVerificationService $documentService) {}

    public function index(Request $request): JsonResponse
    {
        $documents = $request->user()
            ->documents()
            ->with(['reviewer', 'files'])
            ->whereIn('document_type', CustomerDocument::ALLOWED_DOCUMENT_TYPES)
            ->latest()
            ->get();

        return $this->success('Documents fetched successfully.', DocumentResource::collection($documents));
    }

    public function upload(UploadDocumentRequest $request): JsonResponse
    {
        $document = $this->documentService->upload(
            $request->user(),
            $request->validated(),
            [
                'file' => $request->file('file'),
                'front_file' => $request->file('front_file'),
                'back_file' => $request->file('back_file'),
            ]
        );

        return $this->created('Document uploaded successfully.', new DocumentResource($document));
    }
}
