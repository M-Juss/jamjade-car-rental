<?php

namespace App\Http\Requests\Research;

class StoreDriveMonitoringBatchRequest extends InferRcDemoRequest
{
    public function rules(): array
    {
        $number = function ($attribute, $value, $fail) {
            if ((! is_int($value) && ! is_float($value)) || ! is_finite($value)) {
                $fail('Use a finite numeric measurement.');
            }
        };

        return [...parent::rules(), 'client_batch_id' => ['required', 'uuid'],
            'windows.*' => ['required', 'array:id,features,start_ms,end_ms,braking_evidence'],
            'windows.*.start_ms' => ['required', 'integer', 'min:0', 'max:28800000', $number],
            'windows.*.end_ms' => ['required', 'integer', 'min:1', 'max:28800000', $number],
            'windows.*.braking_evidence' => ['required', 'array:peak_ms,vertical_peak,pitch_rate_peak'],
            'windows.*.braking_evidence.peak_ms' => ['required', 'integer', 'min:0', 'max:28800000', $number],
            'windows.*.braking_evidence.vertical_peak' => ['required', 'numeric', 'min:0', 'max:10000', $number],
            'windows.*.braking_evidence.pitch_rate_peak' => ['required', 'numeric', 'min:0', 'max:10000', $number],
        ];
    }

    public function after(): array
    {
        return [function ($validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            $previous = -1;
            foreach ($this->input('windows') as $index => $window) {
                $start = (int) $window['start_ms'];
                $end = (int) $window['end_ms'];
                $peak = (int) $window['braking_evidence']['peak_ms'];
                if ($start % 20 !== 0 || $end % 20 !== 0 || $peak % 20 !== 0
                    || ! in_array($end - $start, [400, 800, 1600, 3200, 5600], true)
                    || $peak < $start || $peak >= $end || $end < $previous
                    || $window['id'] !== "w-$start-$end") {
                    $validator->errors()->add("windows.$index", 'Use ordered complete monitoring windows.');
                }
                $previous = $end;
            }
        }];
    }
}
