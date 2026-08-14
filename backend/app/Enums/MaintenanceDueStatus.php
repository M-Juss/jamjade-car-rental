<?php

namespace App\Enums;

enum MaintenanceDueStatus: string
{
    case Upcoming = 'upcoming';
    case DueSoon = 'due_soon';
    case Due = 'due';
    case Overdue = 'overdue';

    public function label(): string
    {
        return match ($this) {
            self::Upcoming => 'Upcoming',
            self::DueSoon => 'Due Soon',
            self::Due => 'Due',
            self::Overdue => 'Overdue',
        };
    }
}
