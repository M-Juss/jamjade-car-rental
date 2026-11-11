<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Query\Builder;

final class ReportPeriod
{
    public const TIMEZONE = 'Asia/Manila';

    public const MODES = ['day', 'week', 'month', 'year'];

    public readonly CarbonImmutable $start;

    public readonly CarbonImmutable $end;

    public readonly CarbonImmutable $dataEnd;

    public function __construct(public readonly string $mode, ?string $date = null)
    {
        $anchor = $date === null
            ? CarbonImmutable::now(self::TIMEZONE)->startOfDay()
            : CarbonImmutable::parse($date, self::TIMEZONE)->startOfDay();

        [$this->start, $this->end] = match ($mode) {
            'day' => [$anchor, $anchor->addDay()],
            'week' => [$anchor->startOfWeek(CarbonInterface::MONDAY), $anchor->startOfWeek(CarbonInterface::MONDAY)->addWeek()],
            'month' => [$anchor->startOfMonth(), $anchor->startOfMonth()->addMonth()],
            'year' => [$anchor->startOfYear(), $anchor->startOfYear()->addYear()],
        };
        $this->dataEnd = min($this->end, CarbonImmutable::now(self::TIMEZONE));
    }

    public function constrain(Builder $query, string $column): Builder
    {
        return $query->where($column, '>=', $this->start->utc())->where($column, '<', $this->dataEnd->utc());
    }

    public function description(): array
    {
        return ['mode' => $this->mode, 'startDate' => $this->start->toDateString(), 'endDate' => $this->end->subDay()->toDateString()];
    }

    public function bucket(string $utcTimestamp): string
    {
        return $this->key(CarbonImmutable::parse($utcTimestamp, 'UTC')->setTimezone(self::TIMEZONE));
    }

    public function points(array $values): array
    {
        $points = [];
        for ($slot = $this->start; $slot->lt($this->end) && $slot->lte($this->dataEnd); $slot = $this->nextBucket($slot)) {
            $label = match ($this->mode) {
                'day' => $slot->format('H:i'),
                'week', 'month' => $slot->format('M j'),
                'year' => $slot->format('M'),
            };
            $points[$this->key($slot)] = ['label' => $label, ...$values];
        }

        return $points;
    }

    private function key(CarbonImmutable $date): string
    {
        return $date->format(match ($this->mode) {
            'day' => 'Y-m-d H',
            'week', 'month' => 'Y-m-d',
            'year' => 'Y-m',
        });
    }

    private function nextBucket(CarbonImmutable $slot): CarbonImmutable
    {
        return match ($this->mode) {
            'day' => $slot->addHour(),
            'week', 'month' => $slot->addDay(),
            'year' => $slot->addMonth(),
        };
    }
}
