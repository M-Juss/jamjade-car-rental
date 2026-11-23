<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Models\RcNativeRecording;
use App\Models\TelematicsTrip;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TechnicalDashboardController extends Controller
{
    use ApiResponseTrait;

    public function __invoke(Request $request): JsonResponse
    {
        $recordings = RcNativeRecording::query()->where('user_id', $request->user()->id);

        return $this->success('Technical dashboard fetched.', [
            'asOf' => now()->toISOString(),
            'recordings' => (clone $recordings)->count(),
            'verifiedRecordings' => (clone $recordings)->where('state', 'verified')->count(),
            'pendingRecordings' => (clone $recordings)->where('state', '!=', 'verified')->count(),
            'activeMonitoringTrips' => TelematicsTrip::query()->where('status', 'started')->count(),
        ])->header('Cache-Control', 'private, no-store');
    }
}
