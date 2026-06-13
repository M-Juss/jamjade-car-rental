<?php

namespace App\Enums;

enum DocumentStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';

    public function profileLabel(): string
    {
        return match ($this) {
            self::Pending => 'Pending',
            self::Approved => 'Verified',
            self::Rejected => 'Rejected',
        };
    }

    public function bookingLabel(): string
    {
        return match ($this) {
            self::Pending => 'Submitted',
            self::Approved => 'Verified',
            self::Rejected => 'Rejected',
        };
    }
}
