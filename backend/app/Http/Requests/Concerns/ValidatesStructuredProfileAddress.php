<?php

namespace App\Http\Requests\Concerns;

use App\Exceptions\AddressDirectoryException;
use App\Services\PhilippineAddressDirectoryService;
use Illuminate\Contracts\Validation\Validator;

trait ValidatesStructuredProfileAddress
{
    protected function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if (! $this->hasStructuredAddress() || ! $this->hasCompleteStructuredAddress()) {
                return;
            }

            try {
                app(PhilippineAddressDirectoryService::class)->validateSelection($this->only([
                    'region_code',
                    'province_code',
                    'city_municipality_code',
                    'barangay_code',
                ]));
            } catch (AddressDirectoryException $exception) {
                $validator->errors()->add('address_details', $exception->getMessage());
            }
        });
    }

    private function hasStructuredAddress(): bool
    {
        return collect([
            'country_code',
            'region_code',
            'province_code',
            'city_municipality_code',
            'barangay_code',
            'address_line',
        ])->contains(fn (string $field): bool => $this->filled($field));
    }

    private function hasCompleteStructuredAddress(): bool
    {
        return $this->filled('country_code')
            && $this->filled('region_code')
            && $this->filled('city_municipality_code')
            && $this->filled('barangay_code')
            && $this->filled('address_line');
    }
}
