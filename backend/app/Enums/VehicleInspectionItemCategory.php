<?php

namespace App\Enums;

enum VehicleInspectionItemCategory: string
{
    case Exterior = 'exterior';
    case Interior = 'interior';
    case Equipment = 'equipment';
}
