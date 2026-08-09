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
        $notifications = $this->notificationService->paginateForUser(
            $request->user(),
            $request->safe()->only(['category']),
            $request->integer('per_page', 15)
        );

        return $this->paginated('Notifications fetched successfully.', $notifications, NotificationResource::class);
    }

    public function read(Request $request, Notification $notification): JsonResponse
    {
        $notification = $this->notificationService->markAsRead($notification, $request->user());

        return $this->success('Notification marked as read.', new NotificationResource($notification));
    }

    public function readAll(Request $request): JsonResponse
    {
        $count = $this->notificationService->markAllAsRead($request->user());

        return $this->success('Notifications marked as read.', ['updated' => $count]);
    }
}
