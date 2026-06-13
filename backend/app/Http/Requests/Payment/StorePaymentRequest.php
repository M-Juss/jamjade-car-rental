<?php

namespace App\Http\Requests\Payment;

use App\Http\Requests\BaseFormRequest;

class StorePaymentRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'booking_id' => ['required', 'exists:bookings,id'],
            'payment_method' => ['required', 'string', 'max:80'],
            'amount' => ['required', 'numeric', 'min:1'],
            'transaction_id' => ['nullable', 'string', 'max:120'],
            'proof_of_payment' => ['nullable', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
        ];
    }
}
