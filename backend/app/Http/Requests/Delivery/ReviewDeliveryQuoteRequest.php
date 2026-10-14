<?php

namespace App\Http\Requests\Delivery;

use App\Http\Requests\BaseFormRequest;

class ReviewDeliveryQuoteRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('review', $this->route('quote')) ?? false;
    }

    public function rules(): array
    {
        return ['decision' => ['required', 'in:approve,reject'], 'delivery_toll_fee' => ['nullable', 'required_if:decision,approve', 'numeric', 'decimal:0,2', 'between:0,1000000'], 'review_note' => ['nullable', 'required_if:decision,reject', 'string', 'max:1000']];
    }
}
