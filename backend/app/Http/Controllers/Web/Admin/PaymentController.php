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
            ->when($status, function ($query, string $status) {
                $query->where('status', match ($status) {
                    'paid', 'partial' => 'completed',
                    default => $status,
                });
            })
            ->latest()
            ->paginate($request->integer('per_page', 15));

        return $this->paginated('Payments fetched successfully.', $payments, PaymentResource::class);
    }
}
