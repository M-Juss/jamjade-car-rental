<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Telematics\ListFleetRentalsRequest;
use App\Http\Resources\FleetRentalResource;
use App\Services\FleetTrackerService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class FleetTrackerController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly FleetTrackerService $fleet) {}

    public function index(ListFleetRentalsRequest $request): JsonResponse
    {
        $result = $this->fleet->rentals($request->validated());

        return $this->paginated('Active rentals fetched successfully.', $result['rentals'], FleetRentalResource::class,
            ['total_ongoing' => $result['totalOngoing']])->header('Cache-Control', 'no-store');
    }
}
