<?php

namespace App\Http\Resources;

use App\Services\DeliveryQuoteService;
use Illuminate\Http\Resources\Json\JsonResource;

class DeliveryQuoteResource extends JsonResource
{
    public function toArray($request): array
    {
        return ['customerName' => $this->when($request->user()?->can('manage bookings'), fn () => $this->user?->name), 'vehicleName' => $this->when($this->relationLoaded('vehicle'), fn () => $this->vehicle?->name), 'id' => $this->id, 'bookingId' => $this->booking_id !== null ? (string) $this->booking_id : null, 'vehicleId' => (string) $this->vehicle_id, 'rentalStartAt' => $this->rental_start_at->toIso8601String(), 'rentalEndAt' => $this->rental_end_at->toIso8601String(), 'ownerDriverCoverage' => $this->owner_driver_coverage,
            $this->mergeWhen($request->user()?->can('manage bookings') && $this->relationLoaded('vehicle'), fn () => [
                'vehicleBrand' => $this->vehicle?->brand,
                'vehicleModel' => $this->vehicle?->model,
                'vehiclePlateNumber' => $this->vehicle?->plate_number,
            ]),
            'destinationAddress' => $this->destination_address, 'destinationPlaceId' => $this->destination_place_id, 'destinationPoint' => $this->point_expires_at->isFuture() ? $this->destination_point : null,
            'requiresRequote' => ($this->pricing_snapshot['policy_version'] ?? null) !== DeliveryQuoteService::POLICY_VERSION,
            'routeLabel' => $this->route_label, 'tollStatus' => $this->toll_status, 'status' => $this->effectiveStatus(), 'expiresAt' => $this->expires_at?->toIso8601String(), 'reviewDeadline' => $this->review_deadline?->toIso8601String(), 'reviewNote' => $this->review_note,
            'pricePerDay' => $this->price_per_day, 'numberOfDays' => $this->duration_days, 'subtotal' => $this->subtotal, 'ownerDriverFee' => $this->owner_driver_fee, 'deliveryFee' => $this->delivery_fee, 'deliveryTollFee' => $this->delivery_toll_fee,
            'totalAmount' => $this->status === 'ready' || $this->status === 'consumed' ? $this->total() : null, 'downPaymentAmount' => $this->status === 'ready' || $this->status === 'consumed' ? ceil($this->total() / 2) : null,
            'pricingSnapshot' => array_intersect_key($this->pricing_snapshot, array_flip(['minimum_fee', 'included_km', 'per_km_rate'])), 'createdAt' => $this->created_at->toIso8601String()];
    }
}
