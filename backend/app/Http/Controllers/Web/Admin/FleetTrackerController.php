<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Telematics\ListTripsRequest;
use App\Http\Resources\TelematicsTripResource;
use App\Models\TelematicsTrip;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class FleetTrackerController extends Controller
{
    use ApiResponseTrait;

    public function index(ListTripsRequest $request): JsonResponse
    {
        $status = $request->validated('status');

        $trips = TelematicsTrip::query()
            ->with(['booking.user.customerProfile', 'booking.vehicle.images', 'operator', 'events'])
            ->when($status, fn ($query, string $status) => $query->where('status', $status))
            ->latest('last_location_at')
            ->paginate($request->integer('per_page', 15));

        return $this->paginated('Fleet tracker fetched successfully.', $trips, TelematicsTripResource::class);
    }
}
