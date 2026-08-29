<?php

namespace App\Enums;

enum AdditionalChargeType: string
{
    case LateReturn = 'late_return';
    case TollFee = 'toll_fee';
    case VehicleDamage = 'vehicle_damage';
    case Cleaning = 'cleaning';
    case Fuel = 'fuel';
    case TrafficViolation = 'traffic_violation';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::LateReturn => 'Late Return',
            self::TollFee => 'Toll Fee',
            self::VehicleDamage => 'Vehicle Damage',
            self::Cleaning => 'Cleaning',
            self::Fuel => 'Fuel',
            self::TrafficViolation => 'Traffic Violation',
            self::Other => 'Other',
        };
    }
}
