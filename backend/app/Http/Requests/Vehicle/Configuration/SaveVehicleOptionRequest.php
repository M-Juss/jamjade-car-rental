<?php

namespace App\Http\Requests\Vehicle\Configuration;

use App\Http\Requests\BaseFormRequest;
use App\Services\VehicleConfigurationService;
use Illuminate\Validation\Rule;

class SaveVehicleOptionRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasRole('admin') ?? false;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }
    }

    public function rules(): array
    {
        $section = $this->route('option')?->section ?? $this->input('section');
        $max = match ($section) {
            'brand' => 80, 'transmission', 'fuel_type' => 40, default => 120
        };

        return [
            'section' => [$this->isMethod('post') ? 'required' : 'prohibited', Rule::in(VehicleConfigurationService::SECTIONS)],
            'name' => ['required', 'string', 'max:'.$max, function ($attribute, $value, $fail) use ($section) {
                if ($section === 'feature' && is_string($value) && strtolower($value) === 'dashcam') {
                    $fail('Dashcam is no longer offered.');
                }
            }],
            'is_active' => ['required', 'boolean'],
        ];
    }
}
