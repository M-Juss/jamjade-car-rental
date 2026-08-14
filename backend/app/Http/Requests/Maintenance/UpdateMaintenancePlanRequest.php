<?php

namespace App\Http\Requests\Maintenance;

class UpdateMaintenancePlanRequest extends StoreMaintenancePlanRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge(['vehicle_id' => $this->route('plan')?->vehicle_id]);
    }
}
