<?php

namespace App\Support;

final class PayPalAppUrl
{
    private const ALLOWED_SCHEMES = ['exp', 'exps', 'mobilefrontend'];

    public static function isAllowed(string $url): bool
    {
        $scheme = parse_url($url, PHP_URL_SCHEME);

        if (is_string($scheme) && in_array(strtolower($scheme), self::ALLOWED_SCHEMES, true)) {
            return true;
        }

        $origin = self::webOrigin($url);

        if ($origin === null) {
            return false;
        }

        foreach ((array) config('services.paypal.app_callback_origins', []) as $allowedOrigin) {
            if (is_string($allowedOrigin) && self::webOrigin($allowedOrigin) === $origin) {
                return true;
            }
        }

        return false;
    }

    public static function encode(string $url): string
    {
        return rtrim(strtr(base64_encode($url), '+/', '-_'), '=');
    }

    public static function decode(?string $encoded): ?string
    {
        if (! is_string($encoded) || $encoded === '') {
            return null;
        }

        $padding = (4 - strlen($encoded) % 4) % 4;
        $url = base64_decode(strtr($encoded, '-_', '+/').str_repeat('=', $padding), true);

        return is_string($url) && self::isAllowed($url) ? $url : null;
    }

    public static function androidIntent(string $appUrl, string $fallbackUrl): ?string
    {
        $scheme = parse_url($appUrl, PHP_URL_SCHEME);

        if (! is_string($scheme)
            || ! in_array(strtolower($scheme), self::ALLOWED_SCHEMES, true)
            || ! str_contains($appUrl, '://')) {
            return null;
        }

        // The fragment is reserved for Intent extras. Never copy an app URL's
        // fragment into that section, where it could change the launch target.
        $target = explode('#', substr($appUrl, strpos($appUrl, '://') + 3), 2)[0];

        return 'intent://'.$target.'#Intent;scheme='.strtolower($scheme).
            ';S.browser_fallback_url='.rawurlencode($fallbackUrl).';end';
    }

    private static function webOrigin(string $url): ?string
    {
        $parts = parse_url($url);

        if (! is_array($parts)
            || isset($parts['user'])
            || isset($parts['pass'])
            || ! isset($parts['scheme'], $parts['host'])
            || ! is_string($parts['scheme'])
            || ! is_string($parts['host'])) {
            return null;
        }

        $scheme = strtolower($parts['scheme']);

        if (! in_array($scheme, ['http', 'https'], true)) {
            return null;
        }

        $port = isset($parts['port']) ? ':'.$parts['port'] : '';

        return $scheme.'://'.strtolower($parts['host']).$port;
    }
}
