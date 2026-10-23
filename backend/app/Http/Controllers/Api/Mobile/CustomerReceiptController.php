<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\Payment\ListCustomerReceiptsRequest;
use App\Http\Resources\CustomerReceiptResource;
use App\Services\CustomerReceiptService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CustomerReceiptController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly CustomerReceiptService $receipts) {}

    public function index(ListCustomerReceiptsRequest $request, string $booking): JsonResponse
    {
        $booking = $this->receipts->booking($request->user(), $booking);
        $receipts = $this->receipts->query($request->user())->where('booking_id', $booking->id)
            ->orderByDesc('id')->paginate(10);

        return $this->paginated('Receipts fetched successfully.', $receipts, CustomerReceiptResource::class)
            ->header('Cache-Control', 'private, no-store');
    }

    public function show(Request $request, int $receipt): JsonResponse
    {
        return $this->success('Receipt fetched successfully.', new CustomerReceiptResource(
            $this->receipts->find($request->user(), $receipt)
        ))->header('Cache-Control', 'private, no-store');
    }

    public function forOrder(Request $request, string $orderId): JsonResponse
    {
        $payment = $this->receipts->paymentForOrder($request->user(), $orderId);
        $receipt = $this->receipts->query($request->user())->where('payment_id', $payment->id)->first();
        if (! $receipt) {
            return $this->error('Payment received. The receipt is not available yet. Try again shortly.', [], 409)
                ->header('Cache-Control', 'private, no-store');
        }

        return $this->success('Receipt fetched successfully.', new CustomerReceiptResource($receipt))
            ->header('Cache-Control', 'private, no-store');
    }

    public function download(Request $request, int $receipt): StreamedResponse|JsonResponse
    {
        $receipt = $this->receipts->find($request->user(), $receipt);
        $disk = Storage::disk('local');
        if (! $disk->exists($receipt->receipt_path)) {
            return $this->error('The receipt PDF is not available yet. Try again shortly.', [], 409)
                ->header('Cache-Control', 'private, no-store');
        }

        return $disk->download($receipt->receipt_path, $receipt->receipt_filename, [
            'Content-Type' => 'application/pdf', 'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
