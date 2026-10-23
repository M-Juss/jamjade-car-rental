<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\Notification\ListNotificationsRequest;
use App\Http\Resources\NotificationResource;
use App\Models\Notification;
use App\Services\NotificationService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly NotificationService $notificationService) {}

    public function index(ListNotificationsRequest $request): JsonResponse
    {
        if ($request->validated('pagination') === 'cursor') {
            $notifications = $this->notificationService->cursorForUser(
                $request->user(),
                $request->safe()->only(['category', 'booking_code']),
                $request->integer('per_page', 10),
                $request->validated('cursor')
            );

            return $this->success('Notifications fetched successfully.',
                NotificationResource::collection($notifications->getCollection())->resolve(),
                meta: [
                    'next_cursor' => $notifications->nextCursor()?->encode(),
                    'has_more' => $notifications->hasMorePages(),
                    'unread_count' => $this->notificationService->unreadCount($request->user()),
                    'booking_unread_count' => $request->filled('booking_code')
                        ? $this->notificationService->unreadCount($request->user(), $request->validated('booking_code')) : null,
                ]);
        }

        $notifications = $this->notificationService->paginateForUser(
            $request->user(),
            $request->safe()->only(['category', 'booking_code']),
            $request->integer('per_page', 15)
        );

        return $this->paginated('Notifications fetched successfully.', $notifications, NotificationResource::class);
    }

    public function unreadCount(ListNotificationsRequest $request): JsonResponse
    {
        return $this->success('Unread notification count fetched.', [
            'unreadCount' => $this->notificationService->unreadCount($request->user()),
        ]);
    }

    public function read(Request $request, Notification $notification): JsonResponse
    {
        $notification = $this->notificationService->markAsRead($notification, $request->user());

        return $this->success('Notification marked as read.', new NotificationResource($notification),
            meta: ['unread_count' => $this->notificationService->unreadCount($request->user())]);
    }

    public function readAll(ListNotificationsRequest $request): JsonResponse
    {
        $bookingCode = $request->validated('booking_code');
        $count = $this->notificationService->markAllAsRead($request->user(), $bookingCode);

        return $this->success('Notifications marked as read.', ['updated' => $count],
            meta: ['unread_count' => $this->notificationService->unreadCount($request->user())]);
    }
}
