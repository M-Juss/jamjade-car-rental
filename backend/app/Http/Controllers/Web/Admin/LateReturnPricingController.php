<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Booking\UpdateLateReturnPricingRequest;
use App\Models\LateReturnPricingSetting;
use App\Services\LateReturnPricingService;
use App\Services\OwnerVerificationService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class LateReturnPricingController extends Controller
{
    use ApiResponseTrait;

    public function show(LateReturnPricingService $service): JsonResponse
    {
        return $this->success('Late return pricing settings.', $service->settings());
    }

    public function update(UpdateLateReturnPricingRequest $request, LateReturnPricingService $service): JsonResponse
    {
        $data = $request->validated();
        LateReturnPricingSetting::current();

        return app(OwnerVerificationService::class)->run($request, 'Update LateReturnPricing', 'LateReturnPricing', $data,
            fn () => LateReturnPricingSetting::query()->lockForUpdate()->findOrFail(1),
            fn () => $this->success('Late return pricing saved.', $service->update($request->user(), $data)));
    }
}
