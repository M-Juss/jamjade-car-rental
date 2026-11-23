<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Feedback\ListFeedbackRequest;
use App\Http\Resources\PublicFeedbackResource;
use App\Models\BookingFeedback;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class PublicFeedbackController extends Controller
{
    use ApiResponseTrait;

    public function __invoke(ListFeedbackRequest $request): JsonResponse
    {
        $reviews = BookingFeedback::query()->publishable()->where('is_featured', true)
            ->with(['customer:id,name', 'customer.customerProfile:id,user_id,first_name,last_name'])->orderByDesc('featured_at')->orderByDesc('id')->paginate($request->integer('per_page', 20));

        return $this->paginated('Customer feedback.', $reviews, PublicFeedbackResource::class);
    }
}
