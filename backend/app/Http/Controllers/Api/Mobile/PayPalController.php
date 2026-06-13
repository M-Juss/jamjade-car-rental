<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\Payment\CreatePayPalBalanceOrderRequest;
use App\Http\Requests\Payment\CreatePayPalOrderRequest;
use App\Http\Resources\BookingResource;
use App\Services\PayPalCheckoutService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PayPalController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly PayPalCheckoutService $payPalCheckoutService) {}

    public function createOrder(CreatePayPalOrderRequest $request): JsonResponse
    {
        $checkout = $this->payPalCheckoutService->createOrder(
            $request->user(),
            $request->validated()
        );

        return $this->created('PayPal order created successfully.', $checkout);
    }

    public function captureOrder(Request $request, string $orderId): JsonResponse
    {
        $booking = $this->payPalCheckoutService->captureOrder(
            $request->user(),
            $orderId
        );

        return $this->success(
            'PayPal payment captured successfully.',
            new BookingResource($booking)
        );
    }

    public function createBalanceOrder(CreatePayPalBalanceOrderRequest $request, string $booking): JsonResponse
    {
        $checkout = $this->payPalCheckoutService->createBalanceOrder(
            $request->user(),
            $booking,
            $request->validated()
        );

        return $this->created('Remaining balance PayPal order created successfully.', $checkout);
    }

    public function abandonOrder(Request $request, string $orderId): JsonResponse
    {
        $this->payPalCheckoutService->abandonOrder($request->user(), $orderId);

        return $this->success('PayPal checkout abandoned successfully.');
    }
}
