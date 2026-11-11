<?php

namespace App\Http\Requests\Research;

use App\Http\Requests\BaseFormRequest;

class DriveMonitoringReferenceRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('admin');
    }

    public function rules(): array
    {
        return ['research_session_id' => ['required', 'uuid'], 'mount_version_id' => ['required', 'uuid']];
    }
}
