<?php

namespace App\Http\Requests\Maintenance;

use App\Enums\MaintenanceRecordStatus;
use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class ListMaintenanceRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'vehicle_id' => ['nullable', 'integer', 'exists:vehicles,id'],
            'status' => ['nullable', Rule::enum(MaintenanceRecordStatus::class)],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
