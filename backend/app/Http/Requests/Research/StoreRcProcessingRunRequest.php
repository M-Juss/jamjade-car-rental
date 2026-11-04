<?php

namespace App\Http\Requests\Research;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Validator;

class StoreRcProcessingRunRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('admin');
    }

    public function rules(): array
    {
        $reusing = $this->filled('reference_run_id');
        $rules = ['start_ms' => ['required', 'numeric', 'min:0', 'max:86400000'],
            'end_ms' => ['required', 'numeric', 'gt:start_ms', 'max:86400000'],
            'cutoff_hz' => ['required', 'integer', 'in:3,5,8'],
            'confirmed' => ['required', 'boolean', 'in:1,true'],
            'reference_run_id' => ['sometimes', 'required', 'uuid'],
            'same_mount_confirmed' => [$reusing ? 'required' : 'prohibited', 'boolean', 'in:1,true'],
            'ranges' => [$reusing ? 'prohibited' : 'required', 'array:rest,starting,stopping']];
        foreach ($reusing ? [] : ['rest', 'starting', 'stopping'] as $phase) {
            $rules["ranges.$phase"] = ['required', 'array', 'list', 'size:2'];
            $rules["ranges.$phase.*"] = ['required', 'numeric', 'min:0', 'max:86400000'];
        }

        return $rules;
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            $start = (float) $this->input('start_ms');
            $end = (float) $this->input('end_ms');
            if ($end - $start > 30000) {
                $validator->errors()->add('end_ms', 'Select a window of at most 30 seconds.');
            }
            if ($this->filled('reference_run_id')) {
                return;
            }
            $previous = $start;
            foreach (['rest', 'starting', 'stopping'] as $phase) {
                [$a, $b] = array_map('floatval', $this->input("ranges.$phase"));
                if ($a < $previous || $b > $end || $b - $a < 500) {
                    $validator->errors()->add("ranges.$phase", 'Use ordered, separate intervals of at least 0.5 seconds within the window.');
                }
                $previous = $b;
            }
        });
    }
}
