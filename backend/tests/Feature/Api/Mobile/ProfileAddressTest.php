<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function fakeAddressDirectory(): void
{
    Http::fake(function ($request) {
        $url = $request->url();

        return match (true) {
            str_ends_with($url, '/regions') => Http::response([
                'data' => [
                    ['code' => '0400000000', 'name' => 'Region IV-A (CALABARZON)'],
                ],
            ]),
            str_ends_with($url, '/provinces') => Http::response([
                'data' => [
                    ['code' => '0402100000', 'name' => 'Cavite'],
                ],
            ]),
            str_contains($url, '/provinces/0402100000/cities-municipalities/0402106000/barangays') => Http::response([
                'data' => [
                    ['code' => '0402106001', 'name' => 'Barangay 1'],
                ],
            ]),
            str_contains($url, '/provinces/0402100000/cities-municipalities') => Http::response([
                'data' => [
                    ['code' => '0402106000', 'name' => 'City of Dasmarinas', 'type' => 'City'],
                ],
            ]),
            str_contains($url, '/regions/0400000000/provinces')
                && ! str_contains($url, 'cities-municipalities') => Http::response([
                    'data' => [
                        ['code' => '0402100000', 'name' => 'Cavite'],
                    ],
                ]),
            str_contains($url, '/cities-municipalities/0402106000/barangays') => Http::response([
                'data' => [
                    ['code' => '0402106001', 'name' => 'Barangay 1'],
                ],
            ]),
            str_contains($url, '/provinces/0402100000/cities-municipalities') => Http::response([
                'data' => [
                    ['code' => '0402106000', 'name' => 'City of Dasmarinas', 'type' => 'City'],
                ],
            ]),
            default => Http::response(['message' => 'Not found'], 404),
        };
    });

    Cache::flush();
}

it('serves cascading Philippine address directory options', function () {
    fakeAddressDirectory();
    Sanctum::actingAs(User::factory()->create());

    $this->getJson('/api/mobile/address/regions')
        ->assertOk()
        ->assertJsonPath('data.0.code', '0400000000');

    $this->getJson('/api/mobile/address/provinces')
        ->assertOk()
        ->assertJsonPath('data.0.code', '1300000000');

    $this->getJson('/api/mobile/address/cities-municipalities?province_code=0402100000')
        ->assertOk()
        ->assertJsonPath('data.0.code', '0402106000');

    $this->getJson('/api/mobile/address/barangays?region_code=0400000000&province_code=0402100000&city_municipality_code=0402106000')
        ->assertOk()
        ->assertJsonPath('data.0.code', '0402106001');
});

it('persists the selected profile address hierarchy and formatted address', function () {
    fakeAddressDirectory();
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $this->putJson('/api/mobile/profile', [
        'first_name' => 'Juan',
        'last_name' => 'Dela Cruz',
        'phone_number' => '09185550101',
        'birthdate' => '2000-01-15',
        'address' => '123 Main Street, Barangay 1, City of Dasmarinas, Cavite, Region IV-A (CALABARZON)',
        'country_code' => 'PH',
        'region_code' => '0400000000',
        'province_code' => '0402100000',
        'city_municipality_code' => '0402106000',
        'barangay_code' => '0402106001',
        'address_line' => '123 Main Street',
        'postal_code' => '4114',
        'postal_code' => '4114',
    ])
        ->assertOk()
        ->assertJsonPath('data.addressDetails.regionCode', '0400000000')
        ->assertJsonPath('data.addressDetails.barangayCode', '0402106001');

    $this->assertDatabaseHas('customer_profiles', [
        'user_id' => $user->id,
        'address' => '123 Main Street, Barangay 1, City of Dasmarinas, Cavite, Region IV-A (CALABARZON)',
        'region_code' => '0400000000',
        'province_code' => '0402100000',
        'city_municipality_code' => '0402106000',
        'barangay_code' => '0402106001',
        'address_line' => '123 Main Street',
        'postal_code' => '4114',
    ]);
});

it('rejects a barangay that does not belong to the selected city', function () {
    fakeAddressDirectory();
    Sanctum::actingAs(User::factory()->create());

    $this->putJson('/api/mobile/profile', [
        'address' => '123 Main Street, Invalid Barangay',
        'country_code' => 'PH',
        'region_code' => '0400000000',
        'province_code' => '0402100000',
        'city_municipality_code' => '0402106000',
        'barangay_code' => '0402106999',
        'address_line' => '123 Main Street',
        'postal_code' => '4114',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['address_details']);
});

it('requires postal code for a structured profile address', function () {
    fakeAddressDirectory();
    Sanctum::actingAs(User::factory()->create());

    $this->putJson('/api/mobile/profile', [
        'address' => '123 Main Street, Barangay 1, City of Dasmarinas, Cavite',
        'country_code' => 'PH',
        'region_code' => '0400000000',
        'province_code' => '0402100000',
        'city_municipality_code' => '0402106000',
        'barangay_code' => '0402106001',
        'address_line' => '123 Main Street',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['postal_code']);
});
