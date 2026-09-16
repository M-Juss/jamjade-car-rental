<?php

namespace App\Http\Resources;

use App\Support\PublicStorageUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VehicleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $images = $this->whenLoaded('images', fn () => $this->images->map(fn ($image) => [
            'id' => $image->id,
            'url' => $this->imageUrl($image->image_path),
            'imagePath' => $image->image_path,
            'isPrimary' => (bool) $image->is_primary,
            'sortOrder' => $image->sort_order,
        ])->values(), collect());

        $imageUrls = collect($images)->pluck('url')->filter()->values();
        $features = $this->whenLoaded('features', fn () => $this->features->pluck('feature_name')->values(), collect());
        $unavailableDateRanges = $this->whenLoaded(
            'dateBlockingBookings',
            fn () => $this->dateBlockingBookings->map(fn ($booking) => [
                'startDate' => $booking->rental_start_at->toDateString(),
                'endDate' => $booking->rental_end_at->toDateString(),
            ])->values(),
            collect()
        );
        $maintenanceDateRanges = $this->whenLoaded(
            'scheduledMaintenanceWindows',
            fn () => $this->scheduledMaintenanceWindows->map(fn ($record) => [
                'startDate' => $record->scheduled_start->toDateString(),
                'endDate' => $record->scheduled_end->toDateString(),
            ])->values(),
            collect()
        );

        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'brand' => $this->brand,
            'model' => $this->model,
            'pricePerDay' => (float) $this->price_per_day,
            'price' => (float) $this->price_per_day,
            'seats' => $this->seats,
            'transmission' => $this->transmission,
            'fuelType' => $this->fuel_type,
            'fuel' => $this->fuel_type,
            'color' => $this->color,
            'status' => $this->status->value,
            'statusLabel' => $this->status->label(),
            'description' => $this->description,
            'isFeatured' => (bool) $this->is_featured,
            'images' => $imageUrls,
            'imageRecords' => $images,
            'cardImage' => $imageUrls->first(),
            'image' => $imageUrls->first(),
            'features' => $features,
            'unavailableDateRanges' => collect($unavailableDateRanges)->concat($maintenanceDateRanges)->values(),
            'createdAt' => $this->created_at?->toDateString(),
        ];
    }

    private function imageUrl(?string $path): ?string
    {
        return PublicStorageUrl::make($path);
    }
}
