<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\Research\ListRcResearchTrialsRequest;
use App\Http\Requests\Research\StoreRcResearchSessionRequest;
use App\Http\Requests\Research\StoreRcResearchTrialRequest;
use App\Http\Resources\RcResearchNativeAccessResource;
use App\Http\Resources\RcResearchSessionResource;
use App\Http\Resources\RcResearchTrialResource;
use App\Models\RcResearchTrial;
use App\Services\RcResearchService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RcResearchController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly RcResearchService $research) {}

    public function show(): JsonResponse
    {
        return $this->noData('Data Collection access confirmed.')
            ->header('Cache-Control', 'no-store');
    }

    public function nativeAccess(Request $request): JsonResponse
    {
        // The research-token middleware owns role/profile/scope checks. This read grants no new token ability.
        $token = $request->user()->currentAccessToken();
        $expiresAt = $token?->expires_at;
        $globalMinutes = (int) config('sanctum.expiration', 0);
        if ($expiresAt && $globalMinutes > 0) {
            $expiresAt = $expiresAt->min($token->created_at->copy()->addMinutes($globalMinutes));
        }
        $seconds = $expiresAt ? max(0, min(28800, (int) floor(now()->diffInSeconds($expiresAt, false)))) : 0;
        abort_unless($seconds > 0, 403, 'An expiring research session is required. Sign in again.');

        return $this->success('Native research access confirmed.', new RcResearchNativeAccessResource([
            'owner_id' => $request->user()->id,
            'valid_for_seconds' => $seconds,
            'expires_at' => $expiresAt->toISOString(),
        ]))->header('Cache-Control', 'private, no-store');
    }

    public function storeSession(StoreRcResearchSessionRequest $request): JsonResponse
    {
        return $this->created('Research session created.', new RcResearchSessionResource(
            $this->research->createSession($request->user(), $request->validated())
        ))->header('Cache-Control', 'private, no-store');
    }

    public function storeTrial(StoreRcResearchTrialRequest $request, string $session): JsonResponse
    {
        return $this->created('Trial saved.', new RcResearchTrialResource($this->research->storeTrial(
            $this->research->session($request->user(), $session), $request->validated(), $request->samples()
        )))->header('Cache-Control', 'private, no-store');
    }

    public function trials(ListRcResearchTrialsRequest $request): JsonResponse
    {
        $trials = RcResearchTrial::with('session')->whereHas('session', fn ($query) => $query->where('user_id', $request->user()->id))
            ->latest()->orderByDesc('id')->paginate((int) $request->validated('per_page', 15));

        return $this->paginated('Research trials fetched.', $trials, RcResearchTrialResource::class)
            ->header('Cache-Control', 'private, no-store');
    }

    public function destroyTrial(Request $request, string $trial): JsonResponse
    {
        $this->research->deleteTrial($this->research->trial($request->user(), $trial, true));

        return $this->noData('Trial deleted.')->header('Cache-Control', 'private, no-store');
    }
}
