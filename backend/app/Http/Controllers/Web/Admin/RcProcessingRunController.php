<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Research\ListRcNativeRecordingsRequest;
use App\Http\Requests\Research\StoreRcProcessingRunRequest;
use App\Http\Resources\RcProcessingRunResource;
use App\Http\Resources\RcReferenceRunOptionResource;
use App\Models\RcNativeRecording;
use App\Models\RcProcessingRun;
use App\Services\RcNativeResearchService;
use App\Services\RcProcessingRunService;
use App\Services\RcResearchAccessService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RcProcessingRunController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly RcNativeResearchService $research,
        private readonly RcProcessingRunService $runs, private readonly RcResearchAccessService $access) {}

    private function recording(Request $request, string $id): RcNativeRecording
    {
        abort_unless($this->access->enabled(), 403, 'RC Research is unavailable.');

        return $this->research->recording($request->user(), $id);
    }

    public function index(ListRcNativeRecordingsRequest $request, string $recording): JsonResponse
    {
        $record = $this->recording($request, $recording);

        return $this->paginated('Processing runs fetched.', RcProcessingRun::where('recording_id', $record->id)
            ->latest('created_at')->orderByDesc('id')->paginate((int) $request->validated('per_page', 10)), RcProcessingRunResource::class)
            ->header('Cache-Control', 'private, no-store');
    }

    public function store(StoreRcProcessingRunRequest $request, string $recording): JsonResponse
    {
        $run = $this->runs->create($this->recording($request, $recording), $request->validated());

        return $this->detail($run);
    }

    public function references(ListRcNativeRecordingsRequest $request, string $recording): JsonResponse
    {
        return $this->paginated('Reference choices fetched.', $this->runs->referenceOptions(
            $this->recording($request, $recording), (int) $request->validated('per_page', 10)), RcReferenceRunOptionResource::class)
            ->header('Cache-Control', 'private, no-store');
    }

    public function show(Request $request, string $recording, string $run): JsonResponse
    {
        $record = $this->recording($request, $recording);

        return $this->detail(RcProcessingRun::where('recording_id', $record->id)->findOrFail($run));
    }

    private function detail(RcProcessingRun $run): JsonResponse
    {
        return $this->success('Processing result fetched.', ['run' => new RcProcessingRunResource($run), 'result' => $this->runs->result($run)])
            ->header('Cache-Control', 'private, no-store');
    }
}
