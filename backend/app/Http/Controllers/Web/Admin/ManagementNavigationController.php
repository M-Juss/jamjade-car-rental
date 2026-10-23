<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Services\ManagementNavigationService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ManagementNavigationController extends Controller
{
    use ApiResponseTrait;

    public function __invoke(Request $request, ManagementNavigationService $navigation): JsonResponse
    {
        abort_unless($request->user()->canAny(['manage bookings', 'review documents']), 403);

        return $this->success('Navigation counts.', $navigation->counts($request->user()));
    }
}
