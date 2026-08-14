<?php

namespace App\Http\Requests\Maintenance;

use App\Http\Requests\BaseFormRequest;

class CompleteMaintenanceRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'odometer_at_completion' => ['required', 'integer', 'min:0'],
            'work_performed' => ['required', 'string', 'max:5000'],
            'service_provider' => ['nullable', 'string', 'max:150'],
            'technician' => ['nullable', 'string', 'max:150'],
            'labor_cost' => ['nullable', 'numeric', 'min:0', 'max:9999999999.99'],
            'parts_cost' => ['nullable', 'numeric', 'min:0', 'max:9999999999.99'],
            'other_cost' => ['nullable', 'numeric', 'min:0', 'max:9999999999.99'],
            'notes' => ['nullable', 'string', 'max:3000'],
        ];
    }
}
