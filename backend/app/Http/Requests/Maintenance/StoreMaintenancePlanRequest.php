<?php

namespace App\Http\Requests\Maintenance;

use App\Enums\MaintenanceCategory;
use App\Enums\MaintenanceTriggerType;
use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class StoreMaintenancePlanRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'vehicle_id' => ['required', 'integer', 'exists:vehicles,id'],
            'name' => ['required', 'string', 'max:150'],
            'category' => ['required', Rule::enum(MaintenanceCategory::class)],
            'description' => ['nullable', 'string', 'max:2000'],
            'trigger_type' => ['required', Rule::enum(MaintenanceTriggerType::class)],
            'interval_km' => ['nullable', 'required_if:trigger_type,mileage,both', 'integer', 'min:1'],
            'interval_days' => ['nullable', 'required_if:trigger_type,date,both', 'integer', 'min:1'],
            'next_due_odometer' => ['nullable', 'required_if:trigger_type,mileage,both', 'integer', 'min:0'],
            'next_due_date' => ['nullable', 'required_if:trigger_type,date,both', 'date'],
        ];
    }
}
