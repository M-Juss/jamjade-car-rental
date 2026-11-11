<?php

namespace App\Http\Requests\Research;

use App\Http\Requests\BaseFormRequest;

class StartDriveMonitoringRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('admin');
    }

    public function rules(): array
    {
        return [
            'client_session_id' => ['required', 'uuid'],
            'reference_run_id' => ['required', 'uuid'],
            'research_session_id' => ['required', 'uuid'],
            'mount_version_id' => ['required', 'uuid'],
            'consent_version' => ['required', 'in:drive-monitoring-v1'],
            'consent' => ['required', 'accepted'],
            'same_mount_confirmed' => ['required', 'accepted'],
        ];
    }
}
