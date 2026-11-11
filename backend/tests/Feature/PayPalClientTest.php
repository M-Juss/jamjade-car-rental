<?php

use App\Services\PayPalClient;
use Illuminate\Support\Facades\Http;

it('reuses an unexpired access token for order creation and capture', function () {
    config([
        'services.paypal.base_url' => 'https://api-m.sandbox.paypal.com',
        'services.paypal.client_id' => 'sandbox-client-id',
        'services.paypal.client_secret' => 'sandbox-client-secret',
    ]);

    $tokenRequests = 0;

    Http::fake(function ($request) use (&$tokenRequests) {
        if ($request->url() === 'https://api-m.sandbox.paypal.com/v1/oauth2/token') {
            $tokenRequests++;

            return Http::response([
                'access_token' => 'cached-sandbox-token',
                'expires_in' => 3600,
            ]);
        }

        if ($request->url() === 'https://api-m.sandbox.paypal.com/v2/checkout/orders') {
            return Http::response(['id' => 'ORDER-1'], 201);
        }

        if ($request->url() === 'https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER-1/capture') {
            return Http::response(['id' => 'ORDER-1', 'status' => 'COMPLETED']);
        }

        return Http::response([], 404);
    });

    $client = app(PayPalClient::class);

    expect($client->createOrder(['intent' => 'CAPTURE'], 'create-request-1'))
        ->toBe(['id' => 'ORDER-1']);

    expect($client->captureOrder('ORDER-1', 'capture-request-1'))
        ->toBe(['id' => 'ORDER-1', 'status' => 'COMPLETED'])
        ->and($tokenRequests)->toBe(1);

    Http::assertSentCount(3);
});
