<?php

namespace App\Http\Requests\Maintenance;

use App\Enums\MaintenanceCategory;
use App\Enums\MaintenanceTriggerType;
use App\Http\Requests\BaseFormRequest;
use App\Models\Vehicle;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

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
        ];
    }

    /** @return array<int, callable> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->hasAny(['vehicle_id', 'trigger_type'])) {
                return;
            }

            $trigger = $this->input('trigger_type');
            if (! in_array($trigger, ['mileage', 'both'], true)) {
                return;
            }

            $vehicle = Vehicle::query()->with('currentCondition:id,odometer')->find($this->integer('vehicle_id'));
            if ($vehicle?->currentCondition?->odometer === null) {
                $validator->errors()->add(
                    'vehicle_id',
                    'Set the vehicle Current Condition odometer before creating a mileage-based maintenance plan.'
                );
            }
        }];
    }
}
