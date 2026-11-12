<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Research\ListRcNativeRecordingsRequest;
use App\Http\Requests\Research\StoreRcAnnotationsRequest;
use App\Http\Resources\RcAnnotationRevisionResource;
use App\Models\RcNativeRecording;
use App\Services\RcAnnotationService;
use App\Services\RcNativeResearchService;
use App\Services\RcResearchAccessService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RcAnnotationController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly RcNativeResearchService $research, private readonly RcAnnotationService $annotations,
        private readonly RcResearchAccessService $access) {}

    private function recording(Request $request, string $id): RcNativeRecording
    {
        abort_unless($this->access->enabled(), 403, 'Data Collection is unavailable.');

        return $this->research->adminRecording($request->user(), $id);
    }

    public function show(Request $request, string $recording): JsonResponse
    {
        $record = $this->recording($request, $recording);
        $revision = $record->annotationRevisions()->orderByDesc('revision')->first();
        $resource = $revision ? new RcAnnotationRevisionResource($revision) : null;
        if ($resource && $record->collectionContext?->isLegacyLaneChange()) {
            $resource->forLegacyLaneChange();
        }

        return $this->success('Labels fetched.', $resource)->header('Cache-Control', 'private, no-store');
    }

    public function history(ListRcNativeRecordingsRequest $request, string $recording): JsonResponse
    {
        return $this->paginated('Label history fetched.', $this->recording($request, $recording)->annotationRevisions()
            ->select(['id', 'recording_id', 'revision', 'state', 'manifest_sha256', 'created_at'])
            ->orderByDesc('revision')->paginate((int) $request->validated('per_page', 10)), RcAnnotationRevisionResource::class)
            ->header('Cache-Control', 'private, no-store');
    }

    public function revision(Request $request, string $recording, string $revision): JsonResponse
    {
        return $this->success('Label revision fetched.', new RcAnnotationRevisionResource(
            $this->recording($request, $recording)->annotationRevisions()->findOrFail($revision)))->header('Cache-Control', 'private, no-store');
    }

    public function store(StoreRcAnnotationsRequest $request, string $recording): JsonResponse
    {
        return $this->success('Labels saved.', new RcAnnotationRevisionResource($this->annotations->save(
            $this->recording($request, $recording), $request->user()->id, $request->validated())))->header('Cache-Control', 'private, no-store');
    }
}
