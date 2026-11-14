<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\Booking\ListCustomerBookingsRequest;
use App\Http\Requests\Booking\StoreBookingRequest;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Services\BookingService;
use App\Services\DeliveryQuoteService;
use App\Services\OperationalErrorService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class BookingController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly BookingService $bookingService) {}

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
        try {
            $booking = $this->bookingService->create(
                $request->user(), $request->validated(), $request->file('proof_of_payment')
            );
        } catch (Throwable $exception) {
            if (! $exception instanceof ValidationException && ! $exception instanceof HttpExceptionInterface) {
                app(OperationalErrorService::class)->record('booking');
            }
            throw $exception;
        }

        return $this->created('Booking created successfully.', new BookingResource($booking));
    }

    public function show(Request $request, string $booking): JsonResponse
    {
        $booking = $this->findOwnedBooking($request, $booking);

        return $this->success('Booking fetched successfully.', new BookingResource($booking));
    }

    public function deliveryEstimate(Request $request, string $booking, DeliveryQuoteService $quotes): JsonResponse
    {
        $record = $this->findOwnedBooking($request, $booking);
        abort_unless($record->deliveryQuote, 404);

        return $this->success('Current delivery estimate.', $quotes->currentEstimate($record->deliveryQuote));
    }

    private function findOwnedBooking(Request $request, string $booking): Booking
    {
        return Booking::query()
            ->with(['vehicle.images', 'vehicle.features', 'payments', 'user.documents', 'vehicleInspections', 'telematicsTrips',
                'assignedDriver', 'deliveryQuote', 'assignment', 'terms', 'confirmationEmail', 'events', 'telematicsSetupSession', 'returnRecord',
                'additionalCharges' => fn ($query) => $query->where('responsible_user_id', $request->user()->id)->with('responsibleUser')])
            ->where('user_id', $request->user()->id)
            ->where(fn ($query) => $query->where('booking_code', $booking)->orWhere('id', $booking))
            ->firstOrFail();
    }
}
