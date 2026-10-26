<?php

namespace App\Http\Requests\Research;

use App\Http\Requests\BaseFormRequest;

class StoreRcNativeRecordingRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('admin');
    }

    public function rules(): array
    {
        return ['manifest_json' => ['required', 'string', 'max:1048576'],
            'user_id' => ['prohibited'], 'state' => ['prohibited'], 'summary' => ['prohibited']];
    }
}
