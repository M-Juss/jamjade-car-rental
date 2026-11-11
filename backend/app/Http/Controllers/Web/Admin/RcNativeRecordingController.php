<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Research\ListRcNativeRecordingsRequest;
use App\Http\Requests\Research\RcNativeWindowRequest;
use App\Http\Resources\RcNativeRecordingResource;
use App\Http\Resources\RcRecordingReviewResource;
use App\Models\RcMountVersion;
use App\Models\RcNativeRecording;
use App\Services\RcCollectionService;
use App\Services\RcNativeResearchService;
use App\Services\RcRecordingReviewService;
use App\Services\RcResearchAccessService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RcNativeRecordingController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly RcNativeResearchService $research, private readonly RcResearchAccessService $access,
        private readonly RcRecordingReviewService $review, private readonly RcCollectionService $collection) {}

    private function enabled(): void
    {
        abort_unless($this->access->enabled(), 403, 'Data Collection is unavailable.');
    }

    public function index(ListRcNativeRecordingsRequest $request): JsonResponse
    {
        $this->enabled();
        $query = RcNativeRecording::where('user_id', $request->user()->id)->with(['latestAnnotation', 'collectionContext:recording_id,display_code,payload'])->withCount('chunks');
        $sessions = $this->collection->recordingFilterSessions($request->user()->id);
        $groupId = $request->validated('group_id');
        $sessionId = $request->validated('session_id');
        if ($groupId !== null || $sessionId !== null) {
            $sessionIds = collect($sessions)
                ->filter(fn (array $session) => ($groupId === null || strcasecmp($session['group_id'], $groupId) === 0)
                    && ($sessionId === null || strcasecmp($session['id'], $sessionId) === 0))
                ->pluck('id');
            $query->whereHas('collectionContext', fn ($context) => $context->whereIn('mount_id',
                RcMountVersion::query()->whereIn('session_id', $sessionIds)->select('id')));
        }
        $search = $request->validated('search');
        if ($search !== null && $search !== '') {
            $term = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $search).'%';
            $legacyMatches = [];
            if (stripos($search, 'LC') !== false) {
                $legacyTerm = str_ireplace('LC', 'SW', $term);
                $legacyMatches = (clone $query)->withoutEagerLoads()
                    ->whereHas('collectionContext', fn ($context) => $context->whereRaw("display_code LIKE ? ESCAPE '!'", [$legacyTerm]))
                    ->with('collectionContext:recording_id,display_code,payload')
                    ->get(['id'])->filter(fn (RcNativeRecording $record) => $record->collectionContext?->isLegacyLaneChange())
                    ->modelKeys();
            }
            $query->where(fn ($q) => $q->whereRaw("name LIKE ? ESCAPE '!'", [$term])
                ->orWhereHas('collectionContext', fn ($context) => $context->whereRaw("display_code LIKE ? ESCAPE '!'", [$term]))
                ->orWhereRaw("surface LIKE ? ESCAPE '!'", [$term])->orWhereIn('id', $legacyMatches));
        }

        return $this->paginated('Native recordings fetched.', $query->latest('started_at')->orderByDesc('id')
            ->paginate((int) $request->validated('per_page', 10)), RcNativeRecordingResource::class, ['filter_sessions' => $sessions])
            ->header('Cache-Control', 'private, no-store');
    }

    public function show(Request $request, string $recording): JsonResponse
    {
        $this->enabled();
        $record = $this->research->recording($request->user(), $recording)->load(['latestAnnotation', 'collectionContext'])->loadCount('chunks');

        $manifest = $this->research->manifest($record);

        return $this->success('Native recording fetched.', ['recording' => new RcNativeRecordingResource($record),
            'manifest' => $manifest, 'processing' => null, 'reference' => null,
            'review' => new RcRecordingReviewResource($this->review->inspect($record, $manifest))])
            ->header('Cache-Control', 'private, no-store');
    }

    public function window(RcNativeWindowRequest $request, string $recording): JsonResponse
    {
        $this->enabled();

        return $this->success('Original sensor interval fetched.', $this->research->window(
            $this->research->recording($request->user(), $recording), $request->validated('channel'),
            (float) $request->validated('start_ms'), (float) $request->validated('end_ms')))
            ->header('Cache-Control', 'private, no-store');
    }
}
