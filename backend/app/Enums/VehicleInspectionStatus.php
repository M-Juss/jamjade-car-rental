<?php

namespace App\Enums;

enum VehicleInspectionStatus: string
{
    case Draft = 'draft';
    case Finalized = 'finalized';
}
