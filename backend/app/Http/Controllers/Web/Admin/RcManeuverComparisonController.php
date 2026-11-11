<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Research\SaveRcManeuverContactRequest;
use App\Services\RcManeuverComparisonService;
use App\Services\RcResearchAccessService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RcManeuverComparisonController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly RcResearchAccessService $access, private readonly RcManeuverComparisonService $comparison) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensureAvailable();

        return $this->success('Reviewed maneuvers fetched.', $this->comparison->index($request->user()))->header('Cache-Control', 'private, no-store');
    }

    public function signal(Request $request, string $recording, string $annotation, int $index): JsonResponse
    {
        $this->ensureAvailable();

        return $this->success('Prepared signals fetched.', $this->comparison->signal($request->user(), $recording, $annotation, $index))
            ->header('Cache-Control', 'private, no-store');
    }

    public function saveContact(SaveRcManeuverContactRequest $request, string $recording): JsonResponse
    {
        $this->ensureAvailable();
        $this->comparison->saveContact($request->user(), $recording, $request->validated());

        return $this->success('Contact review saved.')->header('Cache-Control', 'private, no-store');
    }

    private function ensureAvailable(): void
    {
        abort_unless($this->access->enabled(), 403, 'Model Explorer is unavailable.');
        abort_unless(app()->isLocal() || config('telematics.hosted_rc_demo'), 503, 'Model Explorer is unavailable.');
    }
}
