<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Research\ListRcNativeRecordingsRequest;
use App\Http\Requests\Research\RcNativeWindowRequest;
use App\Http\Resources\RcNativeRecordingResource;
use App\Models\RcNativeRecording;
use App\Services\RcNativeResearchService;
use App\Services\RcResearchAccessService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RcNativeRecordingController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly RcNativeResearchService $research, private readonly RcResearchAccessService $access) {}

    private function enabled(): void
    {
        abort_unless($this->access->enabled(), 403, 'RC Research is unavailable.');
    }

    public function index(ListRcNativeRecordingsRequest $request): JsonResponse
    {
        $this->enabled();
        $query = RcNativeRecording::where('user_id', $request->user()->id)->withCount('chunks');
        if ($search = $request->validated('search')) {
            $term = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $search).'%';
            $query->where(fn ($q) => $q->whereRaw("name LIKE ? ESCAPE '!'", [$term])->orWhereRaw("surface LIKE ? ESCAPE '!'", [$term]));
        }

        return $this->paginated('Native recordings fetched.', $query->latest('started_at')->orderByDesc('id')
            ->paginate((int) $request->validated('per_page', 10)), RcNativeRecordingResource::class)->header('Cache-Control', 'private, no-store');
    }

    public function show(Request $request, string $recording): JsonResponse
    {
        $this->enabled();
        $record = $this->research->recording($request->user(), $recording)->loadCount('chunks');

        return $this->success('Native recording fetched.', ['recording' => new RcNativeRecordingResource($record),
            'manifest' => $this->research->manifest($record), 'processing' => null, 'reference' => null])
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
