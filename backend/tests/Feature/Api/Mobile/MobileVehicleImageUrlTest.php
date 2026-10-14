<?php

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('uses the trusted local tunnel protocol for vehicle photos', function (string $proxyAddress) {
    $vehicle = availableVehicle();
    $vehicle->images()->delete();
    $vehicle->images()->create([
        'image_path' => '/storage/vehicles/test-car.jpg',
        'is_primary' => true,
    ]);

    $this->withServerVariables(['REMOTE_ADDR' => $proxyAddress])
        ->withHeaders([
            'X-Forwarded-Proto' => 'https',
            'X-Forwarded-Host' => 'untrusted.example',
        ])
        ->getJson('http://rental.test/api/mobile/vehicles')
        ->assertOk()
        ->assertJsonPath('data.0.cardImage', 'https://rental.test/storage/vehicles/test-car.jpg')
        ->assertJsonPath('data.0.images.0', 'https://rental.test/storage/vehicles/test-car.jpg');
})->with(['127.0.0.1', '::1']);

it('keeps direct HTTP vehicle photos on HTTP and ignores untrusted protocol headers', function (string $remoteAddress, array $headers) {
    $vehicle = availableVehicle();
    $vehicle->images()->delete();
    $vehicle->images()->create([
        'image_path' => 'uploads/vehicles/test-car.jpg',
        'is_primary' => true,
    ]);

    $this->withServerVariables(['REMOTE_ADDR' => $remoteAddress])
        ->withHeaders($headers)
        ->getJson('http://rental.test/api/mobile/vehicles')
        ->assertOk()
        ->assertJsonPath('data.0.cardImage', 'http://rental.test/uploads/vehicles/test-car.jpg');
})->with([
    'direct local request' => ['127.0.0.1', []],
    'untrusted forwarded protocol' => ['203.0.113.10', ['X-Forwarded-Proto' => 'https']],
]);
