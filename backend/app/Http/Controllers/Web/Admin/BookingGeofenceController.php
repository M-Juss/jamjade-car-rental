<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Telematics\SaveBookingGeofenceRequest;
use App\Http\Resources\BookingGeofenceResource;
use App\Models\Booking;
use App\Models\BookingGeofence;
use App\Services\BookingGeofenceService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class BookingGeofenceController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly BookingGeofenceService $zones) {}

    public function store(SaveBookingGeofenceRequest $request, Booking $booking): JsonResponse
    {
        $zone = $this->zones->saveCustom($booking, $request->validated(), $request->user());

        return $this->created('Custom monitoring zone created.', new BookingGeofenceResource($zone));
    }

    public function update(SaveBookingGeofenceRequest $request, Booking $booking, BookingGeofence $zone): JsonResponse
    {
        $zone = $this->zones->saveCustom($booking, $request->validated(), $request->user(), $zone);

        return $this->success('Custom monitoring zone updated.', new BookingGeofenceResource($zone));
    }

    public function destroy(Booking $booking, BookingGeofence $zone): JsonResponse
    {
        $this->zones->deleteCustom($booking, $zone);

        return $this->success('Custom monitoring zone removed.');
    }
}
