<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\Research\StoreRcNativeChunkRequest;
use App\Http\Requests\Research\StoreRcNativeRecordingRequest;
use App\Http\Resources\RcNativeRecordingResource;
use App\Services\RcNativeResearchService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RcNativeRecordingController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly RcNativeResearchService $research) {}

    public function store(StoreRcNativeRecordingRequest $request): JsonResponse
    {
        $record = $this->research->begin($request->user(), $request->validated('manifest_json'));

        return $this->success('Recording upload ready.', new RcNativeRecordingResource($record
            ->load('chunks:id,recording_id,channel,chunk_index')->loadCount('chunks')))->header('Cache-Control', 'private, no-store');
    }

    public function chunk(StoreRcNativeChunkRequest $request, string $recording): JsonResponse
    {
        $record = $this->research->chunk($this->research->recording($request->user(), $recording),
            $request->validated('channel'), (int) $request->validated('chunk_index'), $request->validated('payload'));

        return $this->success('Recording chunk received.', new RcNativeRecordingResource($record->loadCount('chunks')))
            ->header('Cache-Control', 'private, no-store');
    }

    public function finalize(Request $request, string $recording): JsonResponse
    {
        return $this->success('Recording verified.', new RcNativeRecordingResource($this->research
            ->finalize($this->research->recording($request->user(), $recording))->loadCount('chunks')))
            ->header('Cache-Control', 'private, no-store');
    }
}
