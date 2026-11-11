<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\Telematics\ListRentalActivityRequest;
use App\Http\Resources\RentalActivityResource;
use App\Services\NotificationService;
use App\Services\RentalActivityService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class RentalActivityController extends Controller
{
    use ApiResponseTrait;

    public function __invoke(
        ListRentalActivityRequest $request,
        string $booking,
        RentalActivityService $activity,
        NotificationService $notifications,
    ): JsonResponse {
        $user = $request->user();
        $page = $activity->page($user, $booking, $request->validated('cursor'));

        return $this->success('Rental activity fetched.',
            RentalActivityResource::collection($page->items())->resolve($request),
            meta: [
                'next_cursor' => $page->nextCursor()?->encode(),
                'has_more' => $page->hasMorePages(),
                'unread_count' => $notifications->unreadCount($user),
                'booking_unread_count' => $notifications->unreadCount($user, $booking),
            ])->header('Cache-Control', 'private, no-store');
    }
}
