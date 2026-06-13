<?php

namespace App\Http\Requests\Vehicle;

use App\Http\Requests\BaseFormRequest;
use Closure;
use Illuminate\Http\UploadedFile;

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

        $this->merge([
            'price_per_day' => $this->input('price_per_day', $this->input('price')),
            'fuel_type' => $this->input('fuel_type', $this->input('fuel')),
        ]);
    }

    public function rules(): array
    {
        $relationRequirement = $this->isMethod('post') ? 'required' : 'sometimes';
        $formFieldRequirement = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'name' => [$formFieldRequirement, 'string', 'max:160'],
            'brand' => [$formFieldRequirement, 'string', 'max:80'],
            'model' => [$formFieldRequirement, 'string', 'max:120'],
            'price_per_day' => [$formFieldRequirement, 'numeric', 'min:1'],
            'seats' => [$formFieldRequirement, 'integer', 'min:1', 'max:20'],
            'transmission' => [$formFieldRequirement, 'string', 'max:40'],
            'fuel_type' => [$formFieldRequirement, 'string', 'max:40'],
            'color' => [$formFieldRequirement, 'string', 'max:80'],
            'status' => [$formFieldRequirement, 'in:available,rented,maintenance,unavailable'],
            'description' => [$formFieldRequirement, 'string', 'max:3000'],
            'is_most_booked' => ['nullable', 'boolean'],
            'features' => [$relationRequirement, 'array', 'min:1'],
            'features.*' => ['string', 'max:120'],
            'images' => [$relationRequirement, 'array', 'min:1'],
            'images.*' => ['required', $this->imageRule()],
        ];
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
