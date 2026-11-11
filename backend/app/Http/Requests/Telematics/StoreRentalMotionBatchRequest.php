<?php

namespace App\Http\Requests\Telematics;

use App\Http\Requests\Research\StoreDriveMonitoringBatchRequest;

class StoreRentalMotionBatchRequest extends StoreDriveMonitoringBatchRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasAnyRole(['customer', 'driver']);
    }
}
