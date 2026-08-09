<?php

namespace App\Http\Controllers\Web\Admin;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Booking\ListBookingsRequest;
use App\Http\Requests\Admin\BookingStatusRequest;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Services\BookingEmailService;
use App\Services\BookingService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class BookingController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        private readonly BookingService $bookingService,
        private readonly BookingEmailService $bookingEmailService
    ) {}

    public function index(ListBookingsRequest $request): JsonResponse
    {
        $bookings = $this->bookingService->paginateForAdmin(
            $request->safe()->only(['search', 'status', 'payment_status']),
            $request->integer('per_page', 15)
        );

        return $this->paginated('Bookings fetched successfully.', $bookings, BookingResource::class);
    }

    public function show(Booking $booking): JsonResponse
    {
        return $this->success(
            'Booking fetched successfully.',
            new BookingResource($booking->load(['vehicle.images', 'vehicle.features', 'payments', 'user.documents', 'user.customerProfile']))
        );
    }

    public function confirm(BookingStatusRequest $request, Booking $booking): JsonResponse
    {
        return $this->statusAction($request, $booking, BookingStatus::Confirmed, 'Booking approved successfully.');
    }

    public function reject(BookingStatusRequest $request, Booking $booking): JsonResponse
    {
        return $this->statusAction($request, $booking, BookingStatus::Rejected, 'Booking rejected successfully.');
    }

    public function cancel(BookingStatusRequest $request, Booking $booking): JsonResponse
    {
        return $this->statusAction($request, $booking, BookingStatus::Cancelled, 'Booking cancelled successfully.');
    }

    public function start(BookingStatusRequest $request, Booking $booking): JsonResponse
    {
        return $this->statusAction($request, $booking, BookingStatus::Ongoing, 'Rental started successfully.');
    }

    public function complete(BookingStatusRequest $request, Booking $booking): JsonResponse
    {
        return $this->statusAction($request, $booking, BookingStatus::Completed, 'Rental completed successfully.');
    }

    public function resendConfirmationEmail(Booking $booking): JsonResponse
    {
        if (! in_array($booking->payment_status, [PaymentStatus::Partial, PaymentStatus::Paid], true)) {
            return $this->error(
                'A booking confirmation email can only be sent after a successful payment.',
                [],
                422
            );
        }

        if (! $this->bookingEmailService->sendBookingConfirmation($booking, force: true)) {
            return $this->error(
                'The booking confirmation email could not be queued. Check the application logs.',
                [],
                500
            );
        }

        return $this->success('Booking confirmation email resent successfully.', [
            'bookingReference' => $booking->booking_code,
            'emailStatus' => BookingEmailService::STATUS_QUEUED,
        ]);
    }

    private function statusAction(BookingStatusRequest $request, Booking $booking, BookingStatus $status, string $message): JsonResponse
    {
        $booking = $this->bookingService->transition(
            $booking,
            $status,
            $request->user(),
            $request->validated('reason'),
            $request->validated()
        );

        return $this->success($message, new BookingResource($booking));
    }
}
