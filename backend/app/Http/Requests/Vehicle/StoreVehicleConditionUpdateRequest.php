<?php

namespace App\Http\Requests\Vehicle;

use App\Enums\VehicleConditionUpdateReason;
use App\Http\Requests\BaseFormRequest;
use App\Models\Vehicle;
use App\Support\VehicleConditionRules;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreVehicleConditionUpdateRequest extends BaseFormRequest
{
    protected function prepareForValidation(): void
    {
        if (is_array($this->input('condition'))) {
            $condition = $this->input('condition');
            $condition['markers'] ??= [];
            $this->merge(['condition' => $condition]);
        }
    }

    public function authorize(): bool
    {
        return $this->user()?->can('manage vehicles') ?? false;
    }

    public function rules(): array
    {
        return [
            'reason' => ['required', Rule::enum(VehicleConditionUpdateReason::class)],
            'notes' => [
                'nullable',
                'string',
                'max:3000',
                Rule::requiredIf(fn () => $this->input('reason') === VehicleConditionUpdateReason::Other->value),
            ],
            ...VehicleConditionRules::rules('condition'),
        ];
    }

    /** @return array<int, callable> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (VehicleConditionRules::markerSequenceErrors($this->input('condition.markers', [])) as $message) {
                $validator->errors()->add('condition.markers', $message);
            }

            if ($validator->errors()->hasAny(['reason', 'notes', 'condition.odometer'])) {
                return;
            }

            $vehicle = $this->conditionVehicle();

            if (! $vehicle instanceof Vehicle || $vehicle->current_condition_inspection_id === null) {
                return;
            }

            $currentOdometer = $vehicle->currentCondition()->value('odometer');
            $newOdometer = $this->integer('condition.odometer');

            if ($currentOdometer === null || $newOdometer >= $currentOdometer) {
                return;
            }

            if ($this->input('reason') !== VehicleConditionUpdateReason::CorrectionReinspection->value) {
                $validator->errors()->add(
                    'condition.odometer',
                    'The odometer cannot be lower than the current condition unless this is a correction or reinspection.'
                );

                return;
            }

            if (blank($this->input('notes'))) {
                $validator->errors()->add(
                    'notes',
                    'Notes are required when correcting the odometer to a lower reading.'
                );
            }
        }];
    }

    protected function conditionVehicle(): ?Vehicle
    {
        $vehicle = $this->route('vehicle');

        return $vehicle instanceof Vehicle ? $vehicle : null;
    }
}
