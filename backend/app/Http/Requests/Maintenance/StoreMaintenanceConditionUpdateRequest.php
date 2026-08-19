<?php

namespace App\Http\Requests\Maintenance;

use App\Enums\MaintenanceCategory;
use App\Http\Requests\Vehicle\StoreVehicleConditionUpdateRequest;
use App\Models\Vehicle;
use App\Models\VehicleMaintenanceRecord;
use Illuminate\Validation\Validator;

class StoreMaintenanceConditionUpdateRequest extends StoreVehicleConditionUpdateRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manage maintenance') ?? false;
    }

    protected function conditionVehicle(): ?Vehicle
    {
        $record = $this->route('maintenanceRecord');

        return $record instanceof VehicleMaintenanceRecord ? $record->vehicle : null;
    }

    /** @return array<int, callable> */
    public function after(): array
    {
        return [
            ...parent::after(),
            function (Validator $validator): void {
                $record = $this->route('maintenanceRecord');
                if (! $record instanceof VehicleMaintenanceRecord || $validator->errors()->has('reason')) {
                    return;
                }

                $allowedReasons = $record->category === MaintenanceCategory::BodyRepair
                    ? ['repair_completed']
                    : ['maintenance_completed', 'repair_completed'];
                if (! in_array($this->input('reason'), $allowedReasons, true)) {
                    $validator->errors()->add(
                        'reason',
                        'Use Maintenance Completed or Repair Completed for maintenance condition verification.'
                    );
                }
            },
        ];
    }
}
