<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Delivery\UpdateDeliveryPricingRequest;
use App\Models\DeliveryPricingSetting;
use App\Services\DeliveryPricingService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class DeliveryPricingController extends Controller
{
    use ApiResponseTrait;

    public function show(): JsonResponse
    {
        return $this->success('Delivery pricing settings.', DeliveryPricingSetting::current()->snapshot());
    }

    public function update(UpdateDeliveryPricingRequest $request, DeliveryPricingService $service): JsonResponse
    {
        return $this->success('Delivery pricing saved.', $service->update($request->user(), $request->validated()));
    }
}
