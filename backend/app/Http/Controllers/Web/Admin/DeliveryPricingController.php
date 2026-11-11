<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Delivery\UpdateDeliveryPricingRequest;
use App\Models\DeliveryPricingSetting;
use App\Models\LateReturnPricingSetting;
use App\Services\DeliveryPricingService;
use App\Services\OwnerVerificationService;
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
        $data = $request->validated();
        DeliveryPricingSetting::current();
        LateReturnPricingSetting::current();

        return app(OwnerVerificationService::class)->run($request, 'Update DeliveryPricing', 'DeliveryPricing', $data,
            fn () => DeliveryPricingSetting::query()->lockForUpdate()->findOrFail(1),
            fn () => $this->success('Delivery pricing saved.', $service->update($request->user(), $data)));
    }
}
