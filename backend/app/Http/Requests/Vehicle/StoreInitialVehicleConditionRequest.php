<?php

namespace App\Http\Requests\Vehicle;

use App\Http\Requests\BaseFormRequest;
use App\Support\VehicleConditionRules;
use Illuminate\Validation\Validator;

class StoreInitialVehicleConditionRequest extends BaseFormRequest
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
        return VehicleConditionRules::rules('condition');
    }

    /** @return array<int, callable> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (VehicleConditionRules::markerSequenceErrors($this->input('condition.markers', [])) as $message) {
                $validator->errors()->add('condition.markers', $message);
            }
        }];
    }
}
