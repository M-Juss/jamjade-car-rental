<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\Booking\CancelBookingRequest;
use App\Http\Requests\Booking\ListCustomerBookingsRequest;
use App\Http\Requests\Booking\StoreBookingRequest;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Services\BookingService;
use App\Services\CalibrationService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BookingController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        private readonly BookingService $bookingService,
        private readonly CalibrationService $calibrationService
    ) {}

    public function index(ListCustomerBookingsRequest $request): JsonResponse
    {
        $bookings = $this->bookingService->paginateForUser(
            $request->user(),
            $request->safe()->only(['status']),
            $request->integer('per_page', 10)
        );

        return $this->paginated('Bookings fetched successfully.', $bookings, BookingResource::class);
    }

    public function store(StoreBookingRequest $request): JsonResponse
    {
        $booking = $this->bookingService->create(
            $request->user(),
            $request->validated(),
            $request->file('proof_of_payment')
        );

        return $this->created('Booking created successfully.', new BookingResource($booking));
    }

    public function show(Request $request, string $booking): JsonResponse
    {
        $booking = $this->findOwnedBooking($request, $booking);

        return $this->success('Booking fetched successfully.', new BookingResource($booking));
    }

    public function cancel(CancelBookingRequest $request, string $booking): JsonResponse
    {
        $booking = $this->bookingService->cancelByCustomer(
            $this->findOwnedBooking($request, $booking),
            $request->user(),
            $request->validated('reason')
        );

        return $this->success('Booking cancelled successfully.', new BookingResource($booking));
    }

    public function calibration(Request $request, string $booking): JsonResponse
    {
        $booking = Booking::query()
            ->where(fn ($query) => $query->where('booking_code', $booking)->orWhere('id', $booking))
            ->firstOrFail();
        $booking = $this->calibrationService->recordPassed($booking, $request->user());

        return $this->success('Calibration recorded successfully.', new BookingResource($booking));
    }

    private function findOwnedBooking(Request $request, string $booking): Booking
    {
        return Booking::query()
            ->with(['vehicle.images', 'vehicle.features', 'payments', 'user.documents', 'vehicleInspections', 'telematicsTrips',
                'additionalCharges' => fn ($query) => $query->where('responsible_user_id', $request->user()->id)->with('responsibleUser')])
            ->where('user_id', $request->user()->id)
            ->where(fn ($query) => $query->where('booking_code', $booking)->orWhere('id', $booking))
            ->firstOrFail();
    }
}
