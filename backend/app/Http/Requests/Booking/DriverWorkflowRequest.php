<?php

namespace App\Http\Requests\Booking;

use App\Http\Requests\BaseFormRequest;

class DriverWorkflowRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('operateDriverService', $this->route('booking')) ?? false;
    }

    public function rules(): array
    {
        return ['action' => ['required', 'string', 'in:on_way,arrived,start_rental']];
    }
}
