<?php

namespace App\Services;

use App\Exceptions\AddressDirectoryException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class PhilippineAddressDirectoryService
{
    private const NCR_CODE = '1300000000';

    public function regions(): array
    {
        return $this->collection('regions');
    }

    public function provinces(?string $regionCode = null): array
    {
        $provinces = $regionCode
            ? $this->collection(sprintf('regions/%s/provinces', $this->segment($regionCode)))
            : $this->collection('provinces');

        if (! $regionCode) {
            array_unshift($provinces, [
                'code' => self::NCR_CODE,
                'name' => 'Metro Manila (NCR)',
                'type' => 'Region',
                'postalCode' => null,
            ]);
        }

        return $provinces;
    }

    public function citiesMunicipalities(?string $regionCode = null, ?string $provinceCode = null): array
    {
        $path = $provinceCode === self::NCR_CODE
            ? sprintf('regions/%s/cities-municipalities', self::NCR_CODE)
            : ($provinceCode && $regionCode
            ? sprintf(
                'regions/%s/provinces/%s/cities-municipalities',
                $this->segment($regionCode),
                $this->segment($provinceCode),
            )
            : ($provinceCode
                ? sprintf('provinces/%s/cities-municipalities', $this->segment($provinceCode))
                : ($regionCode
                    ? sprintf('regions/%s/cities-municipalities', $this->segment($regionCode))
                    : 'cities-municipalities')));

        return $this->collection($path);
    }

    public function barangays(
        string $regionCode,
        string $cityMunicipalityCode,
        ?string $provinceCode = null,
    ): array {
        $path = $provinceCode === self::NCR_CODE
            ? sprintf(
                'regions/%s/cities-municipalities/%s/barangays',
                self::NCR_CODE,
                $this->segment($cityMunicipalityCode),
            )
            : ($provinceCode && $regionCode
            ? sprintf(
                'regions/%s/provinces/%s/cities-municipalities/%s/barangays',
                $this->segment($regionCode),
                $this->segment($provinceCode),
                $this->segment($cityMunicipalityCode),
            )
            : ($provinceCode
                ? sprintf(
                    'provinces/%s/cities-municipalities/%s/barangays',
                    $this->segment($provinceCode),
                    $this->segment($cityMunicipalityCode),
                )
                : sprintf(
                    'regions/%s/cities-municipalities/%s/barangays',
                    $this->segment($regionCode),
                    $this->segment($cityMunicipalityCode),
                )));

        return $this->collection($path);
    }

    public function validateSelection(array $data): void
    {
        if (! ($data['province_code'] ?? null) && $data['region_code'] !== self::NCR_CODE) {
            throw new AddressDirectoryException('A province is required for the selected region.');
        }

        $barangays = $this->barangays(
            (string) $data['region_code'],
            (string) $data['city_municipality_code'],
            $data['province_code'] ?? null,
        );

        $isValid = collect($barangays)->contains(
            fn (array $barangay): bool => $barangay['code'] === (string) $data['barangay_code']
        );

        if (! $isValid) {
            throw new AddressDirectoryException('The selected barangay does not belong to the selected city or municipality.');
        }
    }

    private function collection(string $path): array
    {
        $cacheKey = 'psgc.address.'.sha1($path);
        $ttl = max(60, (int) config('services.psgc.cache_ttl', 86400));

        return Cache::remember($cacheKey, now()->addSeconds($ttl), function () use ($path): array {
            $response = Http::baseUrl(rtrim((string) config('services.psgc.base_url'), '/').'/')
                ->acceptJson()
                ->timeout((int) config('services.psgc.timeout', 5))
                ->get($path);

            if (! $response->successful()) {
                throw new AddressDirectoryException;
            }

            $payload = $response->json();
            $items = is_array($payload) && isset($payload['data']) && is_array($payload['data'])
                ? $payload['data']
                : $payload;

            if (! is_array($items)) {
                throw new AddressDirectoryException;
            }

            return collect($items)
                ->filter(fn ($item): bool => is_array($item) && isset($item['code'], $item['name']))
                ->map(fn (array $item): array => [
                    'code' => (string) $item['code'],
                    'name' => $this->cleanName((string) $item['name']),
                    'type' => isset($item['type']) ? (string) $item['type'] : null,
                    'postalCode' => isset($item['zip_code']) && $item['zip_code'] !== ''
                        ? (string) $item['zip_code']
                        : null,
                ])
                ->values()
                ->all();
        });
    }

    private function segment(string $value): string
    {
        return rawurlencode($value);
    }

    private function cleanName(string $value): string
    {
        if (str_contains($value, 'Ã') || str_contains($value, 'Â')) {
            return mb_convert_encoding($value, 'UTF-8', 'ISO-8859-1');
        }

        return trim($value);
    }
}
