<?php

namespace App\Http\Resources;

use App\Enums\BookingStatus;
use App\Enums\VehicleStatus;
use App\Services\LateReturnPricingService;
use App\Support\PublicStorageUrl;
use Carbon\CarbonImmutable;
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
        $today = CarbonImmutable::today('Asia/Manila')->toDateString();
        $unavailableDateRanges = $this->whenLoaded(
            'mobileDateBlockingBookings',
            fn () => $this->mobileDateBlockingBookings->map(function ($booking) use ($today) {
                $endDate = $booking->rental_end_at->copy()->setTimezone('Asia/Manila')->toDateString();

                return [
                    'startDate' => $booking->rental_start_at->copy()->setTimezone('Asia/Manila')->toDateString(),
                    'endDate' => $booking->status === BookingStatus::Ongoing ? max($endDate, $today) : $endDate,
                ];
            })->values(),
            collect()
        );
        $maintenanceDateRanges = $this->whenLoaded(
            'scheduledMaintenanceWindows',
            fn () => $this->scheduledMaintenanceWindows->map(fn ($record) => [
                'startDate' => $record->scheduled_start->copy()->setTimezone('Asia/Manila')->toDateString(),
                'endDate' => $record->scheduled_end->copy()->setTimezone('Asia/Manila')->toDateString(),
            ])->values(),
            collect()
        );

        $pricing = app(LateReturnPricingService::class);
        $rates = $request->attributes->get('late_return_rates') ?? $pricing->settings();
        $request->attributes->set('late_return_rates', $rates);

        return [
            'lateReturnPolicy' => $pricing->policy($this->resource, $rates),
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
            'canReserve' => $this->whenLoaded('mobileDateBlockingBookings', fn () => $this->status === VehicleStatus::Available
                || ($this->status === VehicleStatus::Rented && $this->mobileDateBlockingBookings->contains('status', BookingStatus::Ongoing))),
            'hasOpenCustomerBooking' => (bool) ($this->resource->getAttributes()['has_open_customer_booking'] ?? false),
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
