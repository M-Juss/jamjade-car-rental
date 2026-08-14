<?php

namespace App\Enums;

enum MaintenanceCategory: string
{
    case Preventive = 'preventive';
    case Corrective = 'corrective';
    case BodyRepair = 'body_repair';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Preventive => 'Preventive',
            self::Corrective => 'Corrective',
            self::BodyRepair => 'Body Repair',
            self::Other => 'Other',
        };
    }
}
