<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\Booking\StoreBookingFeedbackRequest;
use App\Http\Resources\BookingFeedbackResource;
use App\Models\Booking;
use App\Services\BookingFeedbackService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class BookingFeedbackController extends Controller
{
    use ApiResponseTrait;

    public function store(StoreBookingFeedbackRequest $request, Booking $booking, BookingFeedbackService $service): JsonResponse
    {
        return $this->success('Feedback submitted.', new BookingFeedbackResource($service->store($booking, $request->user(), $request->validated())));
    }
}
