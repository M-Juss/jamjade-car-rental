<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DriverBookingController extends Controller
{
    use ApiResponseTrait;

    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasRole('driver'), 403);
        $bookings = Booking::query()
            ->with([
                'vehicle.images', 'vehicle.features', 'user', 'assignedDriver', 'deliveryQuote', 'assignment', 'terms', 'returnRecord', 'confirmationEmail', 'events', 'vehicleInspections', 'telematicsTrips',
                'additionalCharges' => fn ($query) => $query->where('responsible_user_id', $request->user()->id)->with('responsibleUser'),
            ])
            ->whereHas('assignment', fn ($query) => $query->where('driver_id', $request->user()->id))
            ->latest()->paginate(min(max($request->integer('per_page', 20), 1), 100));

        return $this->paginated('Driver services fetched successfully.', $bookings, BookingResource::class);
    }

    public function show(Request $request, string $booking): JsonResponse
    {
        abort_unless($request->user()->hasRole('driver'), 403);
        $record = Booking::query()
            ->with(['vehicle.images', 'vehicle.features', 'user', 'assignedDriver', 'deliveryQuote', 'assignment', 'terms', 'returnRecord', 'confirmationEmail', 'events', 'vehicleInspections', 'telematicsTrips',
                'additionalCharges' => fn ($query) => $query->where('responsible_user_id', $request->user()->id)->with('responsibleUser')])
            ->whereHas('assignment', fn ($query) => $query->where('driver_id', $request->user()->id))
            ->where(fn ($query) => $query->where('booking_code', $booking)->orWhere('id', $booking))
            ->firstOrFail();

        return $this->success('Driver service fetched successfully.', new BookingResource($record));
    }
}
