<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Exceptions\AddressDirectoryException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Address\ListBarangaysRequest;
use App\Http\Requests\Address\ListCitiesMunicipalitiesRequest;
use App\Http\Requests\Address\ListProvincesRequest;
use App\Services\PhilippineAddressDirectoryService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class AddressDirectoryController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        private readonly PhilippineAddressDirectoryService $addressDirectory,
    ) {}

    public function regions(): JsonResponse
    {
        return $this->directoryResponse('Regions fetched successfully.', fn () => $this->addressDirectory->regions());
    }

    public function provinces(ListProvincesRequest $request): JsonResponse
    {
        return $this->directoryResponse(
            'Provinces fetched successfully.',
            fn () => $this->addressDirectory->provinces($request->string('region_code')->toString()),
        );
    }

    public function citiesMunicipalities(ListCitiesMunicipalitiesRequest $request): JsonResponse
    {
        return $this->directoryResponse(
            'Cities and municipalities fetched successfully.',
            fn () => $this->addressDirectory->citiesMunicipalities(
                $request->string('region_code')->toString(),
                $request->input('province_code'),
            ),
        );
    }

    public function barangays(ListBarangaysRequest $request): JsonResponse
    {
        return $this->directoryResponse(
            'Barangays fetched successfully.',
            fn () => $this->addressDirectory->barangays(
                $request->string('region_code')->toString(),
                $request->string('city_municipality_code')->toString(),
                $request->input('province_code'),
            ),
        );
    }

    private function directoryResponse(string $message, callable $callback): JsonResponse
    {
        try {
            return $this->success($message, $callback());
        } catch (AddressDirectoryException) {
            return $this->error(
                'The address directory is temporarily unavailable. Please try again.',
                [],
                503,
            );
        }
    }
}
