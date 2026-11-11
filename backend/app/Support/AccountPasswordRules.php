<?php

namespace App\Support;

use Closure;
use Illuminate\Validation\Rules\Password;

final class AccountPasswordRules
{
    public static function required(): array
    {
        return self::rules('required');
    }

    public static function optional(): array
    {
        return self::rules('nullable');
    }

    private static function rules(string $presence): array
    {
        return [
            $presence,
            'string',
            Password::min(8),
            self::uppercaseRule(),
            self::specialCharacterRule(),
            'max:72',
            self::utf8ByteLimitRule(),
        ];
    }

    private static function uppercaseRule(): Closure
    {
        return static function (string $attribute, mixed $value, Closure $fail): void {
            if (is_string($value) && ! preg_match('/\p{Lu}/u', $value)) {
                $fail('The password must contain at least one uppercase letter.');
            }
        };
    }

    private static function specialCharacterRule(): Closure
    {
        return static function (string $attribute, mixed $value, Closure $fail): void {
            if (is_string($value) && ! preg_match('/[^\p{L}\p{N}\s]/u', $value)) {
                $fail('The password must contain at least one special character.');
            }
        };
    }

    private static function utf8ByteLimitRule(): Closure
    {
        return static function (string $attribute, mixed $value, Closure $fail): void {
            if (is_string($value) && strlen($value) > 72) {
                $fail('The password must be 72 UTF-8 bytes or fewer.');
            }
        };
    }
}
