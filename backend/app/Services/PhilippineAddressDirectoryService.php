<?php

namespace App\Services;

use App\Exceptions\AddressDirectoryException;
use Illuminate\Http\Client\ConnectionException;
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
        $provinces = $this->collection($regionCode ? 'regions/'.rawurlencode($regionCode).'/provinces' : 'provinces');
        if (! $regionCode) {
            array_unshift($provinces, ['code' => self::NCR_CODE, 'name' => 'Metro Manila (NCR)', 'type' => 'Region', 'postalCode' => null]);
        }

        return $provinces;
    }

    public function citiesMunicipalities(?string $regionCode = null, ?string $provinceCode = null): array
    {
        $cities = $this->collection('cities-municipalities', ['limit' => 2000]);
        if ($provinceCode === self::NCR_CODE) {
            $regionCode = self::NCR_CODE;
            $provinceCode = null;
        }

        return array_values(array_filter($cities, fn (array $city): bool => (! $regionCode || $city['regionCode'] === $regionCode)
            && (! $provinceCode || $city['geographicProvinceCode'] === $provinceCode || $city['provinceCode'] === $provinceCode)
        ));
    }

    public function barangays(string $regionCode, string $cityMunicipalityCode, ?string $provinceCode = null): array
    {
        $cities = $this->citiesMunicipalities($regionCode, $provinceCode);
        if (! collect($cities)->contains(fn (array $city): bool => $city['code'] === $cityMunicipalityCode)) {
            throw new AddressDirectoryException('The selected city or municipality does not belong to the selected province or region.');
        }

        return $this->collection('cities-municipalities/'.rawurlencode($cityMunicipalityCode).'/barangays', ['limit' => 1000]);
    }

    public function validateSelection(array $data): void
    {
        if (! ($data['province_code'] ?? null) && $data['region_code'] !== self::NCR_CODE) {
            throw new AddressDirectoryException('A province is required for the selected region.');
        }
        $barangays = $this->barangays((string) $data['region_code'], (string) $data['city_municipality_code'], $data['province_code'] ?? null);
        if (! collect($barangays)->contains(fn (array $barangay): bool => $barangay['code'] === (string) $data['barangay_code'])) {
            throw new AddressDirectoryException('The selected barangay does not belong to the selected city or municipality.');
        }
    }

    private function collection(string $path, array $query = []): array
    {
        $cacheKey = 'psgc-v2.address.'.sha1($path.json_encode($query));
        $ttl = max(60, (int) config('services.psgc.cache_ttl', 86400));

        return Cache::remember($cacheKey, now()->addSeconds($ttl), function () use ($path, $query): array {
            try {
                $response = Http::baseUrl(rtrim((string) config('services.psgc.base_url'), '/').'/')
                    ->acceptJson()->timeout((int) config('services.psgc.timeout', 5))->get($path, $query);
            } catch (ConnectionException $exception) {
                throw new AddressDirectoryException;
            }
            $payload = $response->json();
            if (! $response->successful() || ! is_array($payload) || ! isset($payload['data']) || ! is_array($payload['data']) || ! array_is_list($payload['data']) || ($payload['meta']['hasNextPage'] ?? false)) {
                throw new AddressDirectoryException;
            }
            $postalCodes = json_decode(file_get_contents(config_path('philippine-postal-codes.json')), true, flags: JSON_THROW_ON_ERROR);

            return collect($payload['data'])->filter(fn ($item): bool => is_array($item) && isset($item['code'], $item['name']))
                ->map(fn (array $item): array => [
                    'code' => (string) $item['code'], 'name' => trim((string) $item['name']), 'type' => $item['type'] ?? null,
                    'postalCode' => $postalCodes[$item['code']] ?? null, 'regionCode' => $item['regionCode'] ?? null,
                    'provinceCode' => $item['provinceCode'] ?? null, 'geographicProvinceCode' => $item['geographicProvinceCode'] ?? null,
                ])->values()->all();
        });
    }
}
