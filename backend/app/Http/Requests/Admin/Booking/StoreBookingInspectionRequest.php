<?php

namespace App\Http\Requests\Admin\Booking;

use App\Http\Requests\BaseFormRequest;
use App\Support\VehicleConditionRules;
use Illuminate\Validation\Validator;

class StoreBookingInspectionRequest extends BaseFormRequest
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
        return $this->user()?->can('manage bookings') ?? false;
    }

    public function rules(): array
    {
        return [
            ...VehicleConditionRules::rules('condition'),
            'operator_signature_data' => ['required', 'string', 'max:1400000', 'regex:/^data:image\/png;base64,/'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (VehicleConditionRules::markerSequenceErrors($this->input('condition.markers', [])) as $message) {
                $validator->errors()->add('condition.markers', $message);
            }
        }];
    }
}
