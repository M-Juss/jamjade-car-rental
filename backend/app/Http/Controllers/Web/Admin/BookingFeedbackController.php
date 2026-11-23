<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Feedback\FeatureFeedbackRequest;
use App\Http\Requests\Feedback\ListFeedbackRequest;
use App\Http\Resources\BookingFeedbackResource;
use App\Models\BookingFeedback;
use App\Models\User;
use App\Services\BookingFeedbackService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class BookingFeedbackController extends Controller
{
    use ApiResponseTrait;

    public function index(ListFeedbackRequest $request, User $customer, BookingFeedbackService $service): JsonResponse
    {
        $query = $service->forCustomer($customer);
        $average = (clone $query)->avg('rating');
        $reviews = $query->with('booking.vehicle')->latest()->orderByDesc('id')->paginate($request->integer('per_page', 10));

        return $this->paginated('Lifetime ratings.', $reviews, BookingFeedbackResource::class, ['average_rating' => $average === null ? null : round((float) $average, 1)]);
    }

    public function update(FeatureFeedbackRequest $request, BookingFeedback $feedback, BookingFeedbackService $service): JsonResponse
    {
        return $this->success('Feedback updated.', new BookingFeedbackResource($service->feature($feedback, $request->user(), $request->boolean('is_featured'))));
    }
}
