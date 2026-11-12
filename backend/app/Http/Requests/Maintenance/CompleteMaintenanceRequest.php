<?php

namespace App\Http\Requests\Maintenance;

use App\Enums\MaintenanceCategory;
use App\Http\Requests\BaseFormRequest;
use App\Models\VehicleMaintenanceRecord;
use App\Support\ValidationPatterns;
use Illuminate\Validation\Validator;

class CompleteMaintenanceRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'odometer_at_completion' => ['nullable', 'integer', 'min:0'],
            'work_performed' => ['nullable', 'string', 'max:5000'],
            'service_provider' => ['nullable', 'string', 'max:150'],
            'labor_cost' => ['required', 'numeric', 'regex:'.ValidationPatterns::DECIMAL_2, 'decimal:0,2', 'min:0', 'max:9999999999.99'],
            'parts_cost' => ['required', 'numeric', 'regex:'.ValidationPatterns::DECIMAL_2, 'decimal:0,2', 'min:0', 'max:9999999999.99'],
            'other_cost' => ['required', 'numeric', 'regex:'.ValidationPatterns::DECIMAL_2, 'decimal:0,2', 'min:0', 'max:9999999999.99'],
            'notes' => ['nullable', 'string', 'max:3000'],
            'condition_changed' => ['nullable', 'boolean'],
        ];
    }

    /** @return array<int, callable> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            $record = $this->route('maintenanceRecord');
            if (! $record instanceof VehicleMaintenanceRecord) {
                return;
            }

            if (blank($record->service_provider) && blank($this->input('service_provider'))) {
                $validator->errors()->add('service_provider', 'Enter the service provider.');
            }

            $record->loadMissing('plan');
            if ($record->plan?->trigger_type->usesMileage() && $this->input('odometer_at_completion') === null) {
                $validator->errors()->add(
                    'odometer_at_completion',
                    'The completion odometer is required for a mileage-based maintenance plan.'
                );
            }

            if ($record->category === MaintenanceCategory::BodyRepair && $this->boolean('condition_changed') !== true) {
                $validator->errors()->add(
                    'condition_changed',
                    'Body Repair must continue to Vehicle Condition verification before completion.'
                );
            }

            if (in_array($record->category, [MaintenanceCategory::Corrective, MaintenanceCategory::Other], true)
                && $this->input('condition_changed') === null) {
                $validator->errors()->add(
                    'condition_changed',
                    'Confirm whether this maintenance changed a tracked vehicle condition.'
                );
            }
        }];
    }
}
