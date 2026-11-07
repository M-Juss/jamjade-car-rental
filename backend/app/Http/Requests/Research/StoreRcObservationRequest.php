<?php

namespace App\Http\Requests\Research;

use App\Http\Requests\BaseFormRequest;

class StoreRcObservationRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('admin');
    }

    public function rules(): array
    {
        return ['id' => ['required', 'uuid'], 'base_revision' => ['required', 'integer', 'between:0,99'],
            'reported_at' => ['required', 'date'], 'completed_as_planned' => ['present', 'nullable', 'boolean'],
            'source' => ['required', 'in:observed,operator_report,signal_review'],
            'observer_code' => ['present', 'nullable', 'required_if:source,observed', 'regex:/^OB[0-9]{2,4}$/D'],
            'flags' => ['present', 'array', 'list', 'max:9'],
            'flags.*' => ['required', 'distinct:strict', 'in:steering_corrections,unexpected_reverse,unexpected_turn,bump,cone_contact,phone_shift,holder_loose,interrupted,not_sure'],
            'actual_stop_method' => ['required', 'in:brake_applied,neutral_release,unknown,not_applicable'],
            'initial_deviation' => ['sometimes', 'required', 'string', 'in:left,right,unknown'],
            'notes' => ['present', 'nullable', 'string', 'max:1000']];
    }
}
