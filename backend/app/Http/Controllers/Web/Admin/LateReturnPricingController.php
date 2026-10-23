<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Booking\UpdateLateReturnPricingRequest;
use App\Services\LateReturnPricingService;
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
        return $this->success('Late return pricing saved.', $service->update($request->user(), $request->validated()));
    }
}
