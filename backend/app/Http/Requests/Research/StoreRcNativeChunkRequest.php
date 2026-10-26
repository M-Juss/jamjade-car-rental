<?php

namespace App\Http\Requests\Research;

use App\Http\Requests\BaseFormRequest;

class StoreRcNativeChunkRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('admin');
    }

    public function rules(): array
    {
        return ['channel' => ['required', 'in:accelerometer,gyroscope,gravity,linear_acceleration,rotation_vector'],
            'chunk_index' => ['required', 'integer', 'min:0', 'max:9999'],
            'payload' => ['required', 'string', 'max:1048576'], 'user_id' => ['prohibited'], 'summary' => ['prohibited']];
    }
}
