<?php

namespace App\Http\Requests\Research;

use App\Http\Requests\BaseFormRequest;

class SaveRcManeuverContactRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('admin');
    }

    public function rules(): array
    {
        return [
            'observation_revision_id' => ['present', 'nullable', 'uuid'],
            'first_contact_ms' => ['present', 'nullable', 'integer', 'between:0,86400000'],
        ];
    }
}
