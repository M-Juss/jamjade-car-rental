<?php

namespace App\Enums;

enum MaintenanceTriggerType: string
{
    case Mileage = 'mileage';
    case Date = 'date';
    case Both = 'both';

    public function usesMileage(): bool
    {
        return $this !== self::Date;
    }

    public function usesDate(): bool
    {
        return $this !== self::Mileage;
    }
}
