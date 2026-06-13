<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\Payment\StorePaymentRequest;
use App\Http\Resources\PaymentResource;
use App\Models\Booking;
use App\Services\PaymentService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class PaymentController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly PaymentService $paymentService) {}

    public function store(StorePaymentRequest $request): JsonResponse
    {
        $booking = Booking::where('id', $request->validated('booking_id'))
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $payment = $this->paymentService->record(
            $booking,
            $request->user(),
            $request->validated(),
            $request->file('proof_of_payment')
        );

        return $this->created('Payment submitted successfully.', new PaymentResource($payment));
    }
}
