<?php

namespace App\Http\Resources;

use App\Models\Booking;
use App\Services\TelematicsHandoverEligibilityService;
use App\Support\PublicStorageUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Booking */
class TelematicsRentalResource extends JsonResource
{
    public function __construct(Booking $resource, private readonly bool $customerAvailable)
    {
        parent::__construct($resource);
    }

    public function toArray(Request $request): array
    {
        return [
            'bookingCode' => $this->booking_code,
            'bookingStatus' => $this->status->value,
            'vehicleName' => collect([$this->vehicle?->brand, $this->vehicle?->name, $this->vehicle?->model])->filter()->join(' '),
            'image' => PublicStorageUrl::make($this->vehicle?->images->first()?->image_path),
            'rentalStartAt' => $this->rental_start_at?->toISOString(),
            'rentalEndAt' => $this->rental_end_at?->toISOString(),
            'rentalPeriodEnded' => $this->rental_end_at?->lte(now()) ?? false,
            'hasSetupAttempts' => (bool) $this->has_setup_attempts,
            'eligibility' => app(TelematicsHandoverEligibilityService::class)->evaluate($this->resource, $this->customerAvailable),
        ];
    }
}
