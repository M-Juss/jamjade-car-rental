<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BookingFeedbackResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id, 'rating' => $this->rating, 'comment' => $this->comment,
            'createdAt' => $this->created_at->toISOString(),
            'bookingCode' => $this->whenLoaded('booking', fn () => $this->booking?->booking_code),
            'vehicleName' => $this->whenLoaded('booking', fn () => $this->booking?->vehicle?->name),
            'isFeatured' => $this->when($request->user()?->can('view reports') ?? false, $this->is_featured),
        ];
    }
}
