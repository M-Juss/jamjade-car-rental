<?php

namespace App\Http\Resources;

use App\Support\PublicStorageUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'bookingId' => $this->booking?->booking_code,
            'paymentMethod' => $this->payment_method,
            'paymentStatus' => $this->payment_status->label(),
            'paymentStatusKey' => $this->payment_status->value,
            'amount' => (float) $this->amount,
            'transactionId' => $this->transaction_id,
            'paidAt' => $this->paid_at?->format('F j, Y - g:i A'),
            'proofOfPayment' => PublicStorageUrl::make($this->proof_of_payment),
            'createdAt' => $this->created_at?->toISOString(),
        ];
    }
}
