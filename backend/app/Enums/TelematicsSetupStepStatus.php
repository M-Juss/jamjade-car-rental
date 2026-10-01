<?php

namespace App\Enums;

enum TelematicsSetupStepStatus: string
{
    case Pending = 'pending';
    case InProgress = 'in_progress';
    case Passed = 'passed';
    case Failed = 'failed';
}
