<?php

namespace App\Http\Requests\Maintenance;

use App\Http\Requests\BaseFormRequest;

class RescheduleMaintenanceRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'scheduled_start' => ['required', 'date', 'after_or_equal:'.today('Asia/Manila')->toIso8601String()],
            'scheduled_end' => ['required', 'date', 'after:scheduled_start'],
        ];
    }
}
