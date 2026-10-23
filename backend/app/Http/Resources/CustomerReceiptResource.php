<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class CustomerReceiptResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $context = $this->context;

        return [
            'id' => $this->id,
            'bookingReference' => $context['bookingReference'],
            'receiptReference' => $context['receipt']['reference'],
            'issuedAt' => $context['issuedAt'],
            'currency' => 'PHP',
            'amount' => $context['receipt']['amount'],
            'purpose' => $context['receipt']['purpose'],
            'paidAt' => $context['receipt']['paidAt'],
            'method' => $context['receipt']['method'],
            'transactionReference' => $context['receipt']['transactionId'],
            'vehicleName' => trim(implode(' ', array_filter([
                $context['vehicle']['brand'], $context['vehicle']['name'], $context['vehicle']['model'],
            ]))),
            'rentalType' => $context['rental']['driverOption'],
            'rentalStartAt' => $context['rental']['startAt'],
            'rentalEndAt' => $context['rental']['endAt'],
            'totalPaid' => $context['payment']['amountPaid'],
            'remainingBalance' => $context['payment']['remainingBalance'],
            'bookingTotal' => $context['payment']['totalAmount'],
            'agreedRentalTotal' => $context['agreedRentalTotal'] ?? $context['invoiceSnapshot']['payment']['totalAmount'] ?? $context['payment']['totalAmount'],
            'additionalCharges' => $context['additionalChargeItems'] ?? [],
            'settlementStatus' => $context['paymentStatusLabel'],
            'balanceDueAt' => $context['balanceDueAt'] ?? null,
            'downloadReady' => Storage::disk('local')->exists($this->receipt_path),
        ];
    }
}
