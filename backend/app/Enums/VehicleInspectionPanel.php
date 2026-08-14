<?php

namespace App\Enums;

enum VehicleInspectionPanel: string
{
    case Front = 'front';
    case Right = 'right';
    case Rear = 'rear';
    case Left = 'left';
}
