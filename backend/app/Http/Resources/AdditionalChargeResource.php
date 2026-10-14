<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AdditionalChargeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'type' => $this->type->value,
            'typeLabel' => $this->type->label(),
            'description' => $this->description,
            'amount' => (float) $this->amount,
            'outstandingAmount' => (float) $this->outstanding_amount,
            'responsibility' => $this->responsibility->value,
            'responsibleUser' => $this->whenLoaded('responsibleUser', fn () => [
                'id' => $this->responsibleUser->id,
                'name' => $this->responsibleUser->name,
            ]),
            'paymentStatus' => $this->payment_status->value,
            'paidAt' => $this->paid_at?->toISOString(),
            'createdAt' => $this->created_at?->toISOString(),
        ];
    }
}
