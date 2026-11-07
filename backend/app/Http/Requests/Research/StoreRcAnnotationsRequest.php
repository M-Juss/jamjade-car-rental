<?php

namespace App\Http\Requests\Research;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Validator;

class StoreRcAnnotationsRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('admin');
    }

    public function rules(): array
    {
        return ['base_revision' => ['required', 'integer', 'min:0', 'max:1000'],
            'intervals' => ['present', 'array', 'list', 'max:100'],
            'intervals.*' => ['required', 'array:start_ms,end_ms,movement,direction,severity,certainty,source,notes,initial_deviation'],
            'intervals.*.start_ms' => ['required', 'numeric', 'min:0', 'max:86400000'],
            'intervals.*.end_ms' => ['required', 'numeric', 'min:0', 'max:86400000'],
            'intervals.*.movement' => ['required', 'in:stationary,acceleration,driving,braking,left_turn,right_turn,swerving,other'],
            'intervals.*.direction' => ['required', 'in:forward,reverse,not_applicable,unknown'],
            'intervals.*.severity' => ['required', 'in:normal,harsh,not_applicable,unknown'],
            'intervals.*.certainty' => ['required', 'in:reviewed,uncertain'],
            'intervals.*.source' => ['required', 'in:observed,operator_report,signal_review'],
            'intervals.*.initial_deviation' => ['sometimes', 'required', 'string', 'in:left,right,unknown'],
            'intervals.*.notes' => ['present', 'nullable', 'string', 'max:1000']];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            $previous = 0;
            foreach ($this->input('intervals') as $index => $item) {
                $key = "intervals.$index";
                if ($item['end_ms'] <= $item['start_ms'] || $item['start_ms'] < $previous) {
                    $validator->errors()->add("$key.start_ms", 'Use ordered, nonoverlapping intervals with end after start.');
                }
                $previous = $item['end_ms'];
                if (isset($item['initial_deviation']) && $item['movement'] !== 'swerving') {
                    $validator->errors()->add("$key.initial_deviation", 'Initial deviation is available for swerving intervals only.');
                }
                $stationary = $item['movement'] === 'stationary';
                if ($stationary && ($item['direction'] !== 'not_applicable' || $item['severity'] !== 'not_applicable')) {
                    $validator->errors()->add("$key.movement", 'Stationary intervals use no driving direction or severity.');
                }
                if (! $stationary && ($item['direction'] === 'not_applicable' || $item['severity'] === 'not_applicable')) {
                    $validator->errors()->add("$key.movement", 'Choose a direction and severity, or Unknown.');
                }
                if ($item['certainty'] === 'reviewed' && ($item['source'] === 'signal_review'
                    || $item['direction'] === 'unknown' || $item['severity'] === 'unknown')) {
                    $validator->errors()->add("$key.certainty", 'Signal-only or unknown assessments must remain uncertain.');
                }
            }
        });
    }
}
