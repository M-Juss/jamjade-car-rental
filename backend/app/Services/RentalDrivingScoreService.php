<?php

namespace App\Services;

class RentalDrivingScoreService
{
    public const VERSION = 'rc-deductions-v1';

    public const WEIGHTS = [
        'harsh_acceleration' => 2,
        'harsh_braking' => 2,
        'harsh_cornering' => 3,
        'harsh_swerve' => 3,
    ];

    /** Calculate deductions from confirmed, deduplicated event totals. */
    public function calculate(array $maneuvers): array
    {
        $breakdown = [];
        $deductions = 0;
        foreach (self::WEIGHTS as $target => $points) {
            $count = (int) ($maneuvers[$target] ?? 0);
            $deduction = $count * $points;
            $deductions += $deduction;
            $breakdown[$target] = ['count' => $count, 'points_each' => $points, 'deduction' => $deduction];
        }

        return [
            'policy_version' => self::VERSION,
            'maximum' => 100,
            'deductions' => $deductions,
            'confirmed_events' => array_sum(array_column($breakdown, 'count')),
            'score' => max(0, 100 - $deductions),
            'breakdown' => $breakdown,
        ];
    }

    public function forReceivedReadings(array $maneuvers, bool $hasReadings): array
    {
        $result = $this->calculate($maneuvers);

        return [...$result, 'score' => $hasReadings ? $result['score'] : null,
            'status' => $hasReadings ? 'provisional' : 'not_graded'];
    }
}
