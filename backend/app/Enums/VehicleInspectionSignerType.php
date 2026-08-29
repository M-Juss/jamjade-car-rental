<?php

namespace App\Enums;

enum VehicleInspectionSignerType: string
{
    case Personnel = 'personnel';
    case Renter = 'renter';
    case Driver = 'driver';
}
