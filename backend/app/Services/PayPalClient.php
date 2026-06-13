<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class PayPalClient
{
    public function createOrder(array $payload, string $requestId): array
    {
        return $this->request()
            ->withHeaders(['PayPal-Request-Id' => $requestId])
            ->post('/v2/checkout/orders', $payload)
            ->throw()
            ->json();
    }

    public function captureOrder(string $orderId, string $requestId): array
    {
        return $this->request()
            ->withHeaders(['PayPal-Request-Id' => $requestId])
            ->withBody('{}', 'application/json')
            ->post("/v2/checkout/orders/{$orderId}/capture")
            ->throw()
            ->json();
    }

    private function request(): PendingRequest
    {
        return Http::baseUrl($this->baseUrl())
            ->acceptJson()
            ->asJson()
            ->withToken($this->accessToken())
            ->timeout(30);
    }

    private function accessToken(): string
    {
        $clientId = (string) config('services.paypal.client_id');
        $clientSecret = (string) config('services.paypal.client_secret');

        if ($clientId === '' || $clientSecret === '') {
            throw new RuntimeException('PayPal credentials are not configured.');
        }

        $token = Http::baseUrl($this->baseUrl())
            ->withBasicAuth($clientId, $clientSecret)
            ->asForm()
            ->acceptJson()
            ->timeout(30)
            ->post('/v1/oauth2/token', ['grant_type' => 'client_credentials'])
            ->throw()
            ->json('access_token');

        if (! is_string($token) || $token === '') {
            throw new RuntimeException('PayPal did not return an access token.');
        }

        return $token;
    }

    private function baseUrl(): string
    {
        return rtrim((string) config('services.paypal.base_url'), '/');
    }
}
