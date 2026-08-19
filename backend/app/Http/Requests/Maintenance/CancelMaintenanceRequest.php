<?php

namespace App\Http\Requests\Maintenance;

use App\Http\Requests\BaseFormRequest;

class CancelMaintenanceRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'reason' => ['nullable', 'string', 'max:3000'],
        ];
    }
}
