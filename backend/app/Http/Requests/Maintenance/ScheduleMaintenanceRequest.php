<?php

namespace App\Http\Requests\Maintenance;

use App\Enums\MaintenanceCategory;
use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class ScheduleMaintenanceRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'vehicle_id' => ['required', 'integer', 'exists:vehicles,id'],
            'maintenance_plan_id' => ['nullable', 'integer', 'exists:vehicle_maintenance_plans,id'],
            'category' => ['required_without:maintenance_plan_id', 'nullable', Rule::enum(MaintenanceCategory::class)],
            'title' => ['required_without:maintenance_plan_id', 'nullable', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:2000'],
            'scheduled_start' => ['required', 'date', 'after_or_equal:now'],
            'scheduled_end' => ['required', 'date', 'after:scheduled_start'],
            'service_provider' => ['nullable', 'string', 'max:150'],
            'technician' => ['nullable', 'string', 'max:150'],
            'notes' => ['nullable', 'string', 'max:3000'],
        ];
    }
}
