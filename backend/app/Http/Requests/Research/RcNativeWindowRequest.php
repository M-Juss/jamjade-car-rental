<?php

namespace App\Http\Requests\Research;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Validator;

class RcNativeWindowRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('admin');
    }

    public function rules(): array
    {
        return ['channel' => ['required', 'in:accelerometer,gyroscope,gravity,linear_acceleration,rotation_vector'],
            'start_ms' => ['required', 'numeric', 'min:0', 'max:86400000'],
            'end_ms' => ['required', 'numeric', 'gt:start_ms', 'max:86400000']];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if (! $validator->errors()->has('start_ms') && ! $validator->errors()->has('end_ms')
                && (float) $this->input('end_ms') - (float) $this->input('start_ms') > 30000) {
                $validator->errors()->add('end_ms', 'Select an interval of at most 30 seconds.');
            }
        });
    }
}
