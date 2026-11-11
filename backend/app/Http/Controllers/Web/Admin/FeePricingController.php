<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Delivery\UpdateFeePricingRequest;
use App\Models\DeliveryPricingSetting;
use App\Models\LateReturnPricingSetting;
use App\Services\DeliveryPricingService;
use App\Services\LateReturnPricingService;
use App\Services\OwnerVerificationService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Arr;

class FeePricingController extends Controller
{
    use ApiResponseTrait;

    public function update(UpdateFeePricingRequest $request, DeliveryPricingService $delivery, LateReturnPricingService $late): JsonResponse
    {
        $data = $request->validated();
        DeliveryPricingSetting::current();
        LateReturnPricingSetting::current();

        return app(OwnerVerificationService::class)->run($request, 'Update fee pricing', 'Fee pricing', $data,
            function () {
                $settings = DeliveryPricingSetting::query()->lockForUpdate()->findOrFail(1);
                LateReturnPricingSetting::query()->lockForUpdate()->findOrFail(1);

                return $settings;
            },
            function () use ($request, $data, $delivery, $late) {
                return $this->success('Fee pricing saved.', [
                    'delivery' => $delivery->update($request->user(), Arr::only($data, ['minimum_fee', 'included_km', 'per_km_rate'])),
                    'late' => $late->update($request->user(), Arr::only($data, ['small_vehicle_hourly_rate', 'large_vehicle_hourly_rate'])),
                ]);
            });
    }
}
