<?php

namespace App\Http\Controllers\Web\Admin;

use App\Enums\BookingStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Telematics\ListFleetRentalsRequest;
use App\Http\Resources\FleetRentalResource;
use App\Http\Resources\RentalDrivingAnalysisResource;
use App\Models\Booking;
use App\Services\FleetTrackerService;
use App\Services\RentalDrivingAnalysisService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class FleetTrackerController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly FleetTrackerService $fleet) {}

    public function index(ListFleetRentalsRequest $request): JsonResponse
    {
        $result = $this->fleet->rentals($request->validated(), $request->user()->id);

        return $this->paginated('Active rentals fetched successfully.', $result['rentals'], FleetRentalResource::class,
            ['total_ongoing' => $result['totalOngoing']])->header('Cache-Control', 'no-store');
    }

    public function motion(string $booking, RentalDrivingAnalysisService $analysis): JsonResponse
    {
        $record = Booking::where('booking_code', $booking)->where('status', BookingStatus::Ongoing)->firstOrFail();

        return $this->success('Rental driving events fetched.', new RentalDrivingAnalysisResource($analysis->forBooking($record)))
            ->header('Cache-Control', 'private, no-store');
    }
}
