<?php

namespace App\Enums;

enum VehicleStatus: string
{
    case Available = 'available';
    case Rented = 'rented';
    case Maintenance = 'maintenance';
    case Unavailable = 'unavailable';

    public function label(): string
    {
        return match ($this) {
            self::Available => 'Available',
            self::Rented => 'Rented',
            self::Maintenance => 'Maintenance',
            self::Unavailable => 'Unavailable',
        };
    }
}
