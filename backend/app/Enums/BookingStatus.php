<?php

namespace App\Enums;

enum BookingStatus: string
{
    case Pending = 'pending';
    case Confirmed = 'confirmed';
    case Rejected = 'rejected';
    case Ongoing = 'ongoing';
    case Returned = 'returned';
    case Completed = 'completed';
    case Cancelled = 'cancelled';
    case NoShow = 'no_show';

    public function isTerminal(): bool
    {
        return in_array($this, [self::Completed, self::Cancelled, self::Rejected, self::NoShow], true);
    }

    /** @return list<string> */
    public static function terminalValues(): array
    {
        return array_map(fn (self $status) => $status->value, [self::Completed, self::Cancelled, self::Rejected, self::NoShow]);
    }

    public function mobileLabel(): string
    {
        return match ($this) {
            self::Pending => 'Pending',
            self::Confirmed => 'Confirmed',
            self::Rejected => 'Rejected',
            self::Ongoing => 'Active',
            self::Returned => 'Returned',
            self::Completed => 'Completed',
            self::Cancelled => 'Cancelled',
            self::NoShow => 'No-show',
        };
    }

    public function adminLabel(): string
    {
        return match ($this) {
            self::Pending => 'Pending',
            self::Confirmed => 'Confirmed',
            self::Rejected => 'Rejected',
            self::Ongoing => 'Ongoing',
            self::Returned => 'Returned',
            self::Completed => 'Completed',
            self::Cancelled => 'Cancelled',
            self::NoShow => 'No-show',
        };
    }

    /**
     * @return array<int, self>
     */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Pending => [self::Confirmed, self::Cancelled, self::Rejected],
            self::Confirmed => [self::Ongoing, self::Cancelled, self::NoShow],
            self::Ongoing => [self::Returned],
            self::Returned => [self::Completed],
            self::Completed, self::Cancelled, self::Rejected, self::NoShow => [],
        };
    }
}
