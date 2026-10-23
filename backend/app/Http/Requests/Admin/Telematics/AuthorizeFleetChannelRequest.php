<?php

namespace App\Http\Requests\Admin\Telematics;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class AuthorizeFleetChannelRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('view fleet tracker') ?? false;
    }

    public function rules(): array
    {
        return [
            'socket_id' => ['required', 'string', 'max:100', 'regex:/^\d+\.\d+$/'],
            'channel_name' => ['required', 'string', Rule::in(['private-fleet-monitoring'])],
            'callback' => ['prohibited'],
        ];
    }
}
