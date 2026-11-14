<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\Document\UploadDocumentRequest;
use App\Http\Resources\DocumentResource;
use App\Models\CustomerDocument;
use App\Models\User;
use App\Services\DocumentVerificationService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DocumentController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly DocumentVerificationService $documentService) {}

    public function privacyNotice(): JsonResponse
    {
        $owners = User::role('owner')->where('is_active', true)->limit(2)->get(['id', 'email']);
        abort_unless($owners->count() === 1 && filled($owners->first()->email), 503, 'Privacy contact is unavailable.');

        return $this->success('Document privacy notice fetched.', ['version' => 'document-privacy-v1', 'contact_email' => $owners->first()->email])
            ->header('Cache-Control', 'private, no-store');
    }

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
