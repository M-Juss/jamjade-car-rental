<?php

namespace App\Enums;

enum VehicleInspectionIssueType: string
{
    case Scratch = 'scratch';
    case Dent = 'dent';
    case Crack = 'crack';
    case PaintDamage = 'paint_damage';
    case DamagedPart = 'damaged_part';
    case Other = 'other';
}
