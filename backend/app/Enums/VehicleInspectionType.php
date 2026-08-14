<?php

namespace App\Enums;

enum VehicleInspectionType: string
{
    case Initial = 'initial';
    case Outgoing = 'outgoing';
    case Incoming = 'incoming';
    case ConditionUpdate = 'condition_update';

    public function label(): string
    {
        return match ($this) {
            self::Initial => 'Initial',
            self::Outgoing => 'Outgoing',
            self::Incoming => 'Incoming',
            self::ConditionUpdate => 'Condition Update',
        };
    }
}
