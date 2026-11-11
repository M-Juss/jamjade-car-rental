<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Research\InferRcDemoRequest;
use App\Services\RcDemoInferenceService;
use App\Services\RcResearchAccessService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class RcDemoInferenceController extends Controller
{
    use ApiResponseTrait;

    public function __invoke(InferRcDemoRequest $request, RcDemoInferenceService $inference, RcResearchAccessService $access): JsonResponse
    {
        abort_unless($access->enabled(), 403, 'RC demo is unavailable.');

        return $this->success('Windows classified.', $inference->predict($request->validated()))
            ->header('Cache-Control', 'private, no-store');
    }
}
