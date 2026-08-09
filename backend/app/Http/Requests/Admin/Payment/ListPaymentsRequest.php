<?php

namespace App\Http\Requests\Admin\Payment;

use App\Enums\PaymentStatus;
use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class ListPaymentsRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manage payments') ?? false;
    }

    public function rules(): array
    {
        return [
            'status' => ['sometimes', 'string', Rule::enum(PaymentStatus::class)],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}
