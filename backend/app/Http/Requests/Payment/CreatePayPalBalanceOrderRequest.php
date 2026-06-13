<?php

namespace App\Http\Requests\Payment;

use App\Http\Requests\BaseFormRequest;
use App\Support\PayPalAppUrl;
use Closure;

class CreatePayPalBalanceOrderRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'app_return_url' => $this->appUrlRules(),
            'app_cancel_url' => $this->appUrlRules(),
        ];
    }

    private function appUrlRules(): array
    {
        return [
            'required',
            'string',
            'max:2048',
            function (string $attribute, mixed $value, Closure $fail) {
                if (! is_string($value) || ! PayPalAppUrl::isAllowed($value)) {
                    $fail("The {$attribute} must be a valid JamJade app callback URL.");
                }
            },
        ];
    }
}
