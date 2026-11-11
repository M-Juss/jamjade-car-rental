<?php

namespace App\Http\Requests\Research;

use App\Http\Requests\BaseFormRequest;

class InferRcDemoRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('admin');
    }

    public function rules(): array
    {
        return [
            'version' => ['required', 'in:rc-demo-inference-v1'],
            'windows' => ['required', 'array', 'list', 'min:1', 'max:100'],
            'windows.*' => ['required', 'array:id,features'],
            'windows.*.id' => ['required', 'string', 'max:100', 'distinct:strict'],
            'windows.*.features' => ['required', 'array', 'list', 'size:35'],
            'windows.*.features.*' => ['required', function ($attribute, $value, $fail) {
                if ((! is_int($value) && ! is_float($value)) || ! is_finite($value)) {
                    $fail('Each feature must be a finite number.');
                }
            }],
        ];
    }
}
