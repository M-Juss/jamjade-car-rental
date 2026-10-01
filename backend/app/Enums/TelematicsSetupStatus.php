<?php

namespace App\Enums;

enum TelematicsSetupStatus: string
{
    case Locked = 'locked';
    case SetupRequired = 'setup_required';
    case InProgress = 'in_progress';
    case ReadyForRelease = 'ready_for_release';
    case Released = 'released';
}
