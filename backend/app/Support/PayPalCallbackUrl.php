<?php

namespace App\Support;

use Illuminate\Http\Request;
use RuntimeException;

final class PayPalCallbackUrl
{
    public static function to(string $path, ?Request $request = null): string
    {
        $origin = rtrim(trim((string) config('services.paypal.callback_origin')), '/');

        if ($origin !== '') {
            $parts = parse_url($origin);
            if (! is_array($parts) || ! isset($parts['host'], $parts['scheme'])
                || ! in_array($parts['scheme'], ['http', 'https'], true)
                || isset($parts['user']) || isset($parts['pass'])
                || isset($parts['query']) || isset($parts['fragment']) || ! empty($parts['path'])) {
                throw new RuntimeException('PayPal callback origin must be an HTTP or HTTPS origin without a path, credentials, query, or fragment.');
            }
        } else {
            $origin = $request?->getSchemeAndHttpHost() ?? (string) config('app.url');
        }

        return rtrim($origin, '/').'/'.ltrim($path, '/');
    }
}
