<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Payment\ListPaymentsRequest;
use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class PaymentController extends Controller
{
    use ApiResponseTrait;

    public function index(ListPaymentsRequest $request): JsonResponse
    {
        $status = $request->validated('status');

        $payments = Payment::query()
            ->with(['booking.vehicle', 'user'])
            ->when($status, fn ($query, string $status) => $query->where('payment_status', $status))
            ->latest()
            ->paginate($request->integer('per_page', 15));

        return $this->paginated('Payments fetched successfully.', $payments, PaymentResource::class);
    }
}
