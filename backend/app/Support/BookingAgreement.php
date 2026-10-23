<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use DateTimeInterface;

class BookingAgreement
{
    public const VERSION = '2026-10-19-v4';

    public static function balanceDeadline(DateTimeInterface $start): CarbonImmutable
    {
        return CarbonImmutable::instance($start)->setTimezone('Asia/Manila')->startOfDay()->utc();
    }
}
