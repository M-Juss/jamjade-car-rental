<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\TelematicsTripResource;
use App\Models\TelematicsTrip;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FleetTrackerController extends Controller
{
    use ApiResponseTrait;

    public function index(Request $request): JsonResponse
    {
        $trips = TelematicsTrip::query()
            ->with(['booking.user.customerProfile', 'booking.vehicle.images', 'vehicle.images', 'events', 'geofenceLogs'])
            ->when($request->string('status')->toString(), fn ($query, string $status) => $query->where('status', $status))
            ->latest('last_location_at')
            ->paginate((int) $request->integer('per_page', 15));

        return $this->paginated('Fleet tracker fetched successfully.', $trips, TelematicsTripResource::class);
    }
}
