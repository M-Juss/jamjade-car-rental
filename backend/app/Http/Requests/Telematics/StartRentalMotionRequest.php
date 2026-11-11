<?php

namespace App\Http\Requests\Telematics;

use App\Http\Requests\BaseFormRequest;

class StartRentalMotionRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasAnyRole(['customer', 'driver']);
    }

    public function rules(): array
    {
        return [
            'client_session_id' => ['required', 'uuid'],
            'consent_version' => ['required', 'in:rental-rc-motion-v1'],
            'consent' => ['required', 'boolean', 'accepted'],
            'same_mount_confirmed' => ['required', 'boolean', 'accepted'],
        ];
    }
}
