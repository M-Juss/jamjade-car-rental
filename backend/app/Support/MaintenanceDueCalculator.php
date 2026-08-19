<?php

namespace App\Support;

use App\Enums\MaintenanceDueStatus;
use App\Models\VehicleMaintenancePlan;
use Carbon\CarbonInterface;

class MaintenanceDueCalculator
{
    /** @return array{status: MaintenanceDueStatus, mileage_remaining: ?int, days_remaining: ?int} */
    public function calculate(VehicleMaintenancePlan $plan, ?int $currentOdometer, ?CarbonInterface $today = null): array
    {
        $today ??= today();
        $mileageRemaining = $currentOdometer !== null && $plan->next_due_odometer !== null
            ? (int) $plan->next_due_odometer - $currentOdometer : null;
        $daysRemaining = $plan->next_due_date !== null
            ? $today->startOfDay()->diffInDays($plan->next_due_date->startOfDay(), false) : null;

        $statuses = array_filter([
            $mileageRemaining !== null ? $this->statusForRemaining(
                $mileageRemaining,
                max(1, (int) ceil(((int) $plan->interval_km) * 0.25))
            ) : null,
            $daysRemaining !== null ? $this->statusForRemaining($daysRemaining, (int) config('maintenance.due_soon.days', 7)) : null,
        ]);

        $status = collect($statuses)->sortByDesc(fn (MaintenanceDueStatus $status) => match ($status) {
            MaintenanceDueStatus::Upcoming => 0,
            MaintenanceDueStatus::DueSoon => 1,
            MaintenanceDueStatus::Due => 2,
            MaintenanceDueStatus::Overdue => 3,
        })->first() ?? MaintenanceDueStatus::Upcoming;

        return ['status' => $status, 'mileage_remaining' => $mileageRemaining, 'days_remaining' => $daysRemaining];
    }

    private function statusForRemaining(int $remaining, int $threshold): MaintenanceDueStatus
    {
        return match (true) {
            $remaining < 0 => MaintenanceDueStatus::Overdue,
            $remaining === 0 => MaintenanceDueStatus::Due,
            $remaining <= $threshold => MaintenanceDueStatus::DueSoon,
            default => MaintenanceDueStatus::Upcoming,
        };
    }
}
