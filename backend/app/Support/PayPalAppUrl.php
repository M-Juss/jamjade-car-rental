<?php

namespace App\Support;

final class PayPalAppUrl
{
    private const ALLOWED_SCHEMES = ['exp', 'exps', 'mobilefrontend'];

    public static function isAllowed(string $url): bool
    {
        $scheme = parse_url($url, PHP_URL_SCHEME);

        return is_string($scheme)
            && in_array(strtolower($scheme), self::ALLOWED_SCHEMES, true);
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
}
