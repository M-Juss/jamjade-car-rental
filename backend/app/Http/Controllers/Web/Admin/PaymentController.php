<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    use ApiResponseTrait;

    public function index(Request $request): JsonResponse
    {
        $payments = Payment::query()
            ->with(['booking.vehicle', 'user'])
            ->when($request->string('status')->toString(), fn ($query, string $status) => $query->where('payment_status', $status))
            ->latest()
            ->paginate((int) $request->integer('per_page', 15));

        return $this->paginated('Payments fetched successfully.', $payments, PaymentResource::class);
    }
}
