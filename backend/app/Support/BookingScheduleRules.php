<?php

namespace App\Support;

use Carbon\CarbonImmutable;

final class BookingScheduleRules
{
    public static function futureStart(): array
    {
        return ['required', 'date', 'after:now'];
    }

    public static function selectedStart(): array
    {
        return ['required', 'date', 'after_or_equal:'.CarbonImmutable::now('Asia/Manila')->startOfDay()->toIso8601String()];
    }

    public static function end(): array
    {
        return ['required', 'date', 'after:rental_start_at', 'after:now'];
    }
}
