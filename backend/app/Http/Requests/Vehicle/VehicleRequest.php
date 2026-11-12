<?php

namespace App\Http\Requests\Vehicle;

use App\Http\Requests\BaseFormRequest;
use App\Services\VehicleConfigurationService;
use App\Support\ValidationPatterns;
use App\Support\VehicleConditionRules;
use Closure;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Validator;

class VehicleRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manage vehicles') ?? false;
    }

    protected function prepareForValidation(): void
    {
        if ($this->isMethod('post') && ! $this->filled('status')) {
            $this->merge(['status' => 'available']);
        }

        foreach (['price_per_day' => 'price', 'fuel_type' => 'fuel'] as $field => $alias) {
            if ($this->exists($field) || $this->exists($alias)) {
                $this->merge([$field => $this->input($field, $this->input($alias))]);
            }
        }

        if (is_string($this->input('plate_number'))) {
            $this->merge([
                'plate_number' => strtoupper(trim((string) preg_replace('/\s+/', ' ', $this->input('plate_number')))),
            ]);
        }

        if ($this->isMethod('post') && is_array($this->input('initial_condition'))) {
            $condition = $this->input('initial_condition');
            $condition['markers'] ??= [];
            $this->merge(['initial_condition' => $condition]);
        }
    }

    public function rules(): array
    {
        $relationRequirement = $this->isMethod('post') ? 'required' : 'sometimes';
        $formFieldRequirement = $this->isMethod('post') ? 'required' : 'sometimes';
        $plateNumberUnique = Rule::unique('vehicles', 'plate_number');

        if ($vehicle = $this->route('vehicle')) {
            $plateNumberUnique->ignore($vehicle);
        }

        $rules = [
            'name' => [$formFieldRequirement, 'string', 'max:160', 'regex:'.ValidationPatterns::VEHICLE_TEXT],
            'brand' => [$formFieldRequirement, 'string', 'max:80', 'regex:'.ValidationPatterns::VEHICLE_TEXT],
            'model' => [$formFieldRequirement, 'string', 'max:120', 'regex:'.ValidationPatterns::VEHICLE_TEXT],
            'plate_number' => [$formFieldRequirement, 'string', 'max:32', 'regex:'.ValidationPatterns::PLATE_NUMBER, $plateNumberUnique],
            'price_per_day' => [$formFieldRequirement, 'numeric', 'regex:'.ValidationPatterns::DECIMAL_2, 'between:1,9999999999.99'],
            'seats' => [$formFieldRequirement, 'integer', 'min:1', 'max:20'],
            'transmission' => [$formFieldRequirement, 'string', 'max:40'],
            'fuel_type' => [$formFieldRequirement, 'string', 'max:40'],
            'color' => [$formFieldRequirement, 'string', 'max:80', 'regex:'.ValidationPatterns::VEHICLE_COLOR],
            'status' => [$formFieldRequirement, 'in:available,rented,maintenance,unavailable'],
            'description' => [$formFieldRequirement, 'string', 'max:3000'],
            'is_featured' => ['nullable', 'boolean'],
            'features' => [
                $relationRequirement, 'array', 'min:1',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (! is_array($value)) {
                        return;
                    }

                    foreach ($value as $feature) {
                        if (is_string($feature) && strtolower(trim($feature)) === 'dashcam') {
                            $fail('Dashcam is no longer offered.');

                            return;
                        }
                    }
                },
            ],
            'features.*' => ['string', 'max:120'],
            'images' => [$relationRequirement, 'array', 'min:1', 'max:5'],
            'images.*' => ['required', $this->imageRule()],
        ];

        if ($this->isMethod('post')) {
            $rules = [...$rules, ...VehicleConditionRules::rules()];
        }

        return $rules;
    }

    /** @return array<int, callable> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isEmpty()) {
                try {
                    VehicleConfigurationService::validateVehicleOptions($this->all(), $this->route('vehicle'));
                } catch (ValidationException $exception) {
                    foreach ($exception->errors() as $field => $messages) {
                        $validator->errors()->add($field, $messages[0]);
                    }
                }
            }
            foreach (VehicleConditionRules::markerSequenceErrors($this->input('initial_condition.markers', [])) as $message) {
                $validator->errors()->add('initial_condition.markers', $message);
            }
        }];
    }

    private function imageRule(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if ($value instanceof UploadedFile) {
                if (! str_starts_with((string) $value->getMimeType(), 'image/')) {
                    $fail('The '.$attribute.' must be an image.');
                }

                if ($value->getSize() > 5 * 1024 * 1024) {
                    $fail('The '.$attribute.' must not be greater than 5MB.');
                }

                return;
            }

            if (is_string($value) && trim($value) !== '' && strlen($value) <= 4096) {
                return;
            }

            $fail('The '.$attribute.' must be an image.');
        };
    }
}
