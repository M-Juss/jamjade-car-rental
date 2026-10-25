<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Research\ListRcResearchRecordingsRequest;
use App\Http\Resources\RcResearchTrialResource;
use App\Services\RcResearchAccessService;
use App\Services\RcResearchService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RcResearchController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        private readonly RcResearchService $research,
        private readonly RcResearchAccessService $access,
    ) {}

    public function index(ListRcResearchRecordingsRequest $request): JsonResponse
    {
        abort_unless($this->access->enabled(), 403, 'RC Research is unavailable.');

        return $this->paginated('Research recordings fetched.',
            $this->research->recordings($request->user(), $request->validated()), RcResearchTrialResource::class)
            ->header('Cache-Control', 'private, no-store');
    }

    public function show(Request $request, string $trial): JsonResponse
    {
        abort_unless($this->access->enabled(), 403, 'RC Research is unavailable.');
        $record = $this->research->trial($request->user(), $trial);

        return $this->success('Research recording fetched.', [
            'trial' => new RcResearchTrialResource($record),
            ...$this->research->inspection($record),
        ])->header('Cache-Control', 'private, no-store');
    }
}
