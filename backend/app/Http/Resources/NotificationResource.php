<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'type' => $this->type,
            'category' => $this->category,
            'priority' => $this->priority,
            'title' => $this->title,
            'message' => $this->message,
            'fullMessage' => $this->full_message ?: $this->message,
            'isRead' => $this->read_at !== null,
            'readAt' => $this->read_at?->toISOString(),
            'createdAt' => $this->created_at?->toISOString(),
            'bookingId' => $this->booking?->booking_code,
            'documentId' => $this->customer_document_id,
            'vehicleName' => $this->booking?->vehicle?->name,
            'paymentStatus' => $this->booking?->payment_status?->label(),
            'tripStatus' => $this->booking?->status?->mobileLabel(),
            'actionLabel' => $this->action_label,
            'data' => $this->data ?? [],
        ];
    }
}
