<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

class DeliveryMapsService
{
    private function request(string $url, array $data, string $mask = ''): array
    {
        $key = config('delivery.google_key');
        if (! $key) {
            throw ValidationException::withMessages(['destination' => ['Delivery maps are unavailable. Choose garage pickup or try again later.']]);
        }
        try {
            $r = Http::timeout(15)->connectTimeout(5)->withHeaders(['X-Goog-Api-Key' => $key, ...($mask !== '' ? ['X-Goog-FieldMask' => $mask] : [])])->post($url, $data);
            if (! $r->successful()) {
                throw new \RuntimeException;
            }

            return $r->json() ?? [];
        } catch (\Throwable) {
            throw ValidationException::withMessages(['destination' => ['Delivery routes could not be retrieved. Try again or choose garage pickup.']]);
        }
    }

    public function suggestions(string $input, string $token): array
    {
        $r = $this->request('https://places.googleapis.com/v1/places:autocomplete', ['input' => $input, 'sessionToken' => $token, 'includedRegionCodes' => ['ph'], 'includedPrimaryTypes' => ['street_address', 'premise', 'subpremise', 'route']]);

        return collect($r['suggestions'] ?? [])->map(fn ($s) => $s['placePrediction'] ?? null)->filter()->map(fn ($p) => ['placeId' => $p['placeId'], 'description' => $p['text']['text'] ?? ''])->values()->all();
    }

    public function place(string $id, string $token): array
    {
        $key = config('delivery.google_key');
        if (! $key) {
            throw ValidationException::withMessages(['place_id' => ['Delivery maps are unavailable.']]);
        }
        try {
            $r = Http::timeout(15)->connectTimeout(5)->withHeaders(['X-Goog-Api-Key' => $key, 'X-Goog-FieldMask' => 'id,location'])->get('https://places.googleapis.com/v1/places/'.rawurlencode($id), ['sessionToken' => $token]);
            if (! $r->successful() || ! isset($r->json()['location'])) {
                throw new \RuntimeException;
            }
            $p = $r->json();

            return ['placeId' => $p['id'], 'latitude' => $p['location']['latitude'], 'longitude' => $p['location']['longitude']];
        } catch (\Throwable) {
            throw ValidationException::withMessages(['place_id' => ['This address could not be resolved. Choose another result.']]);
        }
    }

    public function routes(array $origin, array $destination): array
    {
        $r = $this->request('https://routes.googleapis.com/directions/v2:computeRoutes', [
            'origin' => ['location' => ['latLng' => $origin]], 'destination' => ['location' => ['latLng' => $destination]],
            'travelMode' => 'DRIVE', 'routingPreference' => 'TRAFFIC_AWARE', 'computeAlternativeRoutes' => true,
        ], 'routes.distanceMeters,routes.duration');
        $routes = $r['routes'] ?? [];
        if (! is_array($routes) || ! $routes || count($routes) > 10) {
            throw ValidationException::withMessages(['destination' => ['No available driving route was found. Choose another location.']]);
        }
        foreach ($routes as $route) {
            if (! is_array($route) || ! isset($route['distanceMeters'], $route['duration']) || ! is_int($route['distanceMeters']) || $route['distanceMeters'] < 0 || ! is_string($route['duration']) || ! preg_match('/^\d+(?:\.\d+)?s$/', $route['duration']) || ! is_finite((float) rtrim($route['duration'], 's'))) {
                throw ValidationException::withMessages(['destination' => ['The route response was incomplete. Try again.']]);
            }
        }

        return $routes;
    }
}
