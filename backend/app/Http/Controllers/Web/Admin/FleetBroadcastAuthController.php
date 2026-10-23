<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Telematics\AuthorizeFleetChannelRequest;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Broadcast;

class FleetBroadcastAuthController extends Controller
{
    use ApiResponseTrait;

    public function __invoke(AuthorizeFleetChannelRequest $request): JsonResponse
    {
        abort_unless(config('broadcasting.default') === 'reverb', 503);

        return $this->success('Fleet connection authorized.', Broadcast::auth($request))
            ->header('Cache-Control', 'no-store');
    }
}
