<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Throwable;

class PayPalClient
{
    private const TOKEN_CACHE_SAFETY_SECONDS = 60;

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
            ->connectTimeout(5)
            ->timeout(30);
    }

    private function accessToken(): string
    {
        $clientId = (string) config('services.paypal.client_id');
        $clientSecret = (string) config('services.paypal.client_secret');

        if ($clientId === '' || $clientSecret === '') {
            throw new RuntimeException('PayPal credentials are not configured.');
        }

        $cacheKey = $this->tokenCacheKey($clientId, $clientSecret);

        try {
            $cachedToken = Cache::get($cacheKey);

            if (is_string($cachedToken) && $cachedToken !== '') {
                return $cachedToken;
            }
        } catch (Throwable) {
            // Token caching is optional; continue with PayPal if the cache is unavailable.
        }

        $response = Http::baseUrl($this->baseUrl())
            ->withBasicAuth($clientId, $clientSecret)
            ->asForm()
            ->acceptJson()
            ->connectTimeout(5)
            ->timeout(30)
            ->post('/v1/oauth2/token', ['grant_type' => 'client_credentials'])
            ->throw();

        $token = $response->json('access_token');

        if (! is_string($token) || $token === '') {
            throw new RuntimeException('PayPal did not return an access token.');
        }

        $expiresIn = filter_var($response->json('expires_in'), FILTER_VALIDATE_INT);
        $cacheSeconds = max(1, (int) ($expiresIn ?: 60) - self::TOKEN_CACHE_SAFETY_SECONDS);

        try {
            Cache::put($cacheKey, $token, now()->addSeconds($cacheSeconds));
        } catch (Throwable) {
            // Payment requests still work if the cache write fails.
        }

        return $token;
    }

    private function tokenCacheKey(string $clientId, string $clientSecret): string
    {
        $identity = implode('|', [$this->baseUrl(), $clientId, $clientSecret]);

        return 'paypal.oauth-token.'.hash('sha256', $identity);
    }

    private function baseUrl(): string
    {
        return rtrim((string) config('services.paypal.base_url'), '/');
    }
}
