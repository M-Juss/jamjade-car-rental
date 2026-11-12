<?php

namespace App\Http\Requests\Telematics;

use App\Http\Requests\BaseFormRequest;

class StopRentalMotionRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasAnyRole(['customer', 'driver']);
    }

    public function rules(): array
    {
        return ['reason' => ['sometimes', 'required', 'string', 'in:interrupted']];
    }
}
