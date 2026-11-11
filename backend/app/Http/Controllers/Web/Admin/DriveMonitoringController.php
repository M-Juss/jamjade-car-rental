<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Research\ListRcNativeRecordingsRequest;
use App\Http\Resources\DriveMonitoringSessionResource;
use App\Models\DriveMonitoringBatch;
use App\Models\DriveMonitoringEvent;
use App\Models\DriveMonitoringSession;
use App\Services\RcResearchAccessService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DriveMonitoringController extends Controller
{
    use ApiResponseTrait;

    public function index(ListRcNativeRecordingsRequest $request, RcResearchAccessService $access): JsonResponse
    {
        abort_unless($access->enabled(), 403, 'Drive Monitoring is unavailable.');

        return $this->paginated('Monitoring sessions fetched.',
            DriveMonitoringSession::whereNull('telematics_trip_id')->where('user_id', $request->user()->id)->with('researchSession:id,session_number')->latest()
                ->paginate((int) $request->validated('per_page', 10)), DriveMonitoringSessionResource::class)
            ->header('Cache-Control', 'private, no-store');
    }

    public function show(Request $request, string $session, RcResearchAccessService $access): JsonResponse
    {
        abort_unless($access->enabled(), 403, 'Drive Monitoring is unavailable.');
        $record = DriveMonitoringSession::whereNull('telematics_trip_id')->where('user_id', $request->user()->id)->with('researchSession:id,session_number')->findOrFail($session);
        $batches = DriveMonitoringBatch::where('session_id', $record->id)->latest()->orderByDesc('id')->limit(10)->get();
        $eventCounts = DriveMonitoringEvent::where('session_id', $record->id)
            ->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return $this->success('Monitoring session fetched.', [
            'session' => new DriveMonitoringSessionResource($record),
            'received_batches' => DriveMonitoringBatch::where('session_id', $record->id)->count(),
            'latest_received_at' => $batches->first()?->created_at?->toISOString(),
            'event_summary' => ['detected' => (int) ($eventCounts['confirmed'] ?? 0),
                'needs_review' => (int) ($eventCounts['review_required'] ?? 0),
                'pending' => (int) ($eventCounts['pending'] ?? 0)],
            'events' => DriveMonitoringEvent::where('session_id', $record->id)->whereNotIn('status', ['pending', 'suppressed'])
                ->latest('emitted_ms')->limit(50)->get()->map(fn ($event) => [
                    'id' => $event->id, 'target' => $event->target, 'status' => $event->status,
                    'start_ms' => $event->start_ms, 'end_ms' => $event->end_ms,
                    'vote' => $event->vote, 'received_at' => $event->created_at->toISOString(),
                ]),
            'recent_predictions' => $batches->map(fn ($batch) => [
                'batch_id' => $batch->client_batch_id, 'received_at' => $batch->created_at->toISOString(),
                'predictions' => $batch->predictions['predictions'],
            ]),
        ])->header('Cache-Control', 'private, no-store');
    }
}
