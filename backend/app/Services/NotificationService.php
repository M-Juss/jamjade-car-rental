<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\CustomerDocument;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class NotificationService
{
    public function paginateForUser(User $user, array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        return Notification::query()
            ->with('booking.vehicle')
            ->where('user_id', $user->id)
            ->when($filters['category'] ?? null, fn ($query, string $category) => $query->where('category', $category))
            ->latest()
            ->paginate($perPage);
    }

    public function createForBooking(Booking $booking, string $category, string $title, string $message, array $data = []): Notification
    {
        return Notification::create([
            'user_id' => $booking->user_id,
            'booking_id' => $booking->id,
            'type' => 'booking',
            'category' => $category,
            'priority' => $data['priority'] ?? 'normal',
            'title' => $title,
            'message' => $message,
            'full_message' => $data['full_message'] ?? $message,
            'data' => $data,
            'action_label' => $data['action_label'] ?? null,
        ]);
    }

    public function createForDocument(
        CustomerDocument $document,
        string $title,
        string $message,
        array $data = []
    ): Notification {
        return Notification::create([
            'user_id' => $document->user_id,
            'customer_document_id' => $document->id,
            'type' => 'document_verification',
            'category' => 'system',
            'priority' => $data['priority'] ?? 'normal',
            'title' => $title,
            'message' => $message,
            'full_message' => $data['full_message'] ?? $message,
            'data' => [
                ...$data,
                'action' => $data['action'] ?? 'view_documents',
                'documentId' => $document->id,
                'documentType' => $document->document_type,
                'documentStatus' => $document->status->value,
            ],
            'action_label' => $data['action_label'] ?? 'View Documents',
        ]);
    }

    public function markAsRead(Notification $notification, User $user): Notification
    {
        abort_unless($notification->user_id === $user->id, 403);

        $notification->forceFill(['read_at' => now()])->save();

        return $notification->fresh('booking.vehicle');
    }

    public function markAllAsRead(User $user): int
    {
        return Notification::query()
            ->where('user_id', $user->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);
    }
}
