<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use DateTimeInterface;
use Throwable;

final class CustomerAgePolicy
{
    public const MINIMUM_AGE = 18;

    public const MESSAGE = 'Bookings are available only to customers aged 18 or older. Please enter a valid birthdate.';

    private const TIMEZONE = 'Asia/Manila';

    public static function latestEligibleBirthdate(): string
    {
        return CarbonImmutable::now(self::TIMEZONE)
            ->startOfDay()
            ->subYearsNoOverflow(self::MINIMUM_AGE)
            ->toDateString();
    }

    public static function isEligible(DateTimeInterface|string|null $birthdate): bool
    {
        if ($birthdate === null || $birthdate === '') {
            return false;
        }

        try {
            $date = $birthdate instanceof DateTimeInterface
                ? $birthdate->format('Y-m-d')
                : $birthdate;

            return CarbonImmutable::parse($date, self::TIMEZONE)
                ->startOfDay()
                ->lessThanOrEqualTo(
                    CarbonImmutable::parse(self::latestEligibleBirthdate(), self::TIMEZONE)
                );
        } catch (Throwable) {
            return false;
        }
    }
}
