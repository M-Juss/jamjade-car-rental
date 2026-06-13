<?php

namespace App\Enums;

enum RentalType: string
{
    case SelfDrive = 'self_drive';
    case OwnersDriver = 'owners_driver';

    public function label(): string
    {
        return match ($this) {
            self::SelfDrive => 'Self-Drive',
            self::OwnersDriver => "Owner's Driver",
        };
    }
}
