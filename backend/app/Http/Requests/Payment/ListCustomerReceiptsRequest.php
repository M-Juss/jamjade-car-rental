<?php

namespace App\Http\Requests\Payment;

use App\Http\Requests\BaseFormRequest;

class ListCustomerReceiptsRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasRole('customer') ?? false;
    }

    public function rules(): array
    {
        return ['page' => ['sometimes', 'integer', 'min:1']];
    }
}
