<?php

namespace App\Services;

use App\Models\User;
use App\Models\Vehicle;
use App\Support\ReportPeriod;
use Carbon\CarbonImmutable;

class ReportCsvExportService
{
    private const SECTIONS = [
        'overview' => 'Overview',
        'revenue' => 'Revenue',
        'bookings' => 'Bookings',
        'fleet' => 'Fleet Performance',
        'customers' => 'Customer Insights',
        'telematics' => 'Risk & Telematics',
    ];

    public function __construct(private readonly ReportAnalyticsService $analytics) {}

    public function filename(ReportPeriod $period): string
    {
        $range = match ($period->mode) {
            'day' => 'Day-'.$period->start->format('M-d-Y'),
            'week' => 'Week-'.$period->start->format('M-d-Y').'-to-'.$period->end->subDay()->format('M-d-Y'),
            'month' => 'Month-'.$period->start->format('M-Y'),
            'year' => 'Year-'.$period->start->format('Y'),
        };

        return 'JamJade-Reports-and-Analytics-'.$range.'.csv';
    }

    /** @param resource $output */
    public function write($output, User $viewer, ReportPeriod $period, array $filters): void
    {
        fwrite($output, "\xEF\xBB\xBF");
        $this->row($output, ['JamJade Car Rental - Reports and Analytics']);
        $this->row($output, ['Period', $period->start->format('M j, Y').' - '.$period->end->subDay()->format('M j, Y')]);
        $this->row($output, ['Search', $filters['search'] ?? 'All']);
        $vehicle = isset($filters['vehicle_id']) ? Vehicle::withTrashed()->findOrFail($filters['vehicle_id']) : null;
        $this->row($output, ['Vehicle', $vehicle ? $vehicle->name.' ('.$vehicle->plate_number.')' : 'All']);
        $this->row($output, ['Rental type', match ($filters['rental_type'] ?? null) {
            'self_drive' => 'Self Drive', 'owners_driver' => 'With Assigned Driver', default => 'All',
        }]);
        $this->row($output, ['Currency', 'PHP']);
        $this->row($output, ['Generated', CarbonImmutable::now(ReportPeriod::TIMEZONE)->format('M j, Y, g:i A')]);

        $sections = $viewer->can('view financial reports') ? self::SECTIONS : array_intersect_key(self::SECTIONS, array_flip(['bookings', 'telematics']));
        foreach ($sections as $section => $label) {
            $data = $this->analytics->exportSection($section, $period, $filters);
            $this->row($output, []);
            $this->row($output, [$label]);
            $this->row($output, ['Summary']);
            $this->row($output, ['Metric', 'Value', 'Unit']);
            foreach ($data['metrics'] as $metric) {
                $this->metric($output, $metric);
                foreach ($metric['details'] ?? [] as $detail) {
                    $this->metric($output, $detail);
                }
            }
            foreach ($data['charts'] as $chart) {
                $this->row($output, []);
                $this->row($output, [$chart['title']]);
                $this->row($output, [$chart['type'] === 'horizontal' ? 'Category' : 'Period', ...array_map(
                    fn ($series) => $series['label'].match ($chart['format']) {
                        'money' => ' (PHP)', 'hours' => ' (hours)', default => ''
                    },
                    $chart['series'])]);
                foreach ($chart['points'] as $point) {
                    $this->row($output, [$point['label'], ...array_map(fn ($series) => $this->value($point[$series['key']] ?? null, $chart['format']), $chart['series'])]);
                }
                if ($chart['points'] === []) {
                    $this->row($output, ['No records found.']);
                }
            }
            if ($data['records'] !== null) {
                $table = $data['records'];
                // Match the visible customer table, whose lifetime average remains explicit.
                $columns = $section === 'customers' ? array_values(array_filter($table['columns'], fn ($column) => $column['key'] !== 'last_completed')) : $table['columns'];
                $this->row($output, []);
                $this->row($output, [$table['title']]);
                $this->row($output, array_column($columns, 'label'));
                $empty = true;
                foreach ($table['rows'] as $record) {
                    $empty = false;
                    $this->row($output, array_map(fn ($column) => $this->value($record[$column['key']], $column['format']), $columns));
                }
                if ($empty) {
                    $this->row($output, ['No records found.']);
                }
            }
            if ($section === 'telematics' && $viewer->can('manage bookings') && $viewer->can('view fleet tracker')) {
                $this->operators($output, $period, $filters);
            }
        }
    }

    /** @param resource $output */
    private function operators($output, ReportPeriod $period, array $filters): void
    {
        $this->row($output, []);
        $this->row($output, ['Operators needing attention (Below '.RentalDrivingOverviewService::ATTENTION_GRADE_THRESHOLD.')']);
        $this->row($output, ['Operator', 'Operator type', 'Average grade', 'Graded rentals', 'Latest grade', 'Harsh events', 'Rentals with incomplete sync', 'Latest grade sync incomplete']);
        $empty = true;
        $page = 1;
        do {
            // Read bounded pages, independently of either currently displayed page.
            $operators = $this->analytics->operatorsNeedingAttention($period, [...$filters, 'operator_page' => $page]);
            foreach ($operators as $operator) {
                $empty = false;
                $this->row($output, [$operator->operator_name ?? 'Not recorded', $operator->operator_type === 'driver' ? 'Driver' : 'Customer',
                    number_format((float) $operator->average_score, 1, '.', '').' / 100', $operator->monitored_rentals,
                    $operator->latest_score === null ? 'Not graded' : $operator->latest_score.' / 100', $operator->harsh_events,
                    $operator->incomplete_grades, $operator->latest_sync_incomplete ? 'Yes' : 'No']);
            }
        } while (++$page <= $operators->lastPage());
        if ($empty) {
            $this->row($output, ['No graded operators below '.RentalDrivingOverviewService::ATTENTION_GRADE_THRESHOLD.' / 100 in this period.']);
        }
    }

    /** @param resource $output */
    private function metric($output, array $metric): void
    {
        $this->row($output, [$metric['label'], $this->value($metric['value'], $metric['format']), match ($metric['format']) {
            'money' => 'PHP', 'hours' => 'Hours', default => 'Count',
        }]);
    }

    private function value(int|float|string|null $value, string $format): int|float|string
    {
        if ($value === null) {
            return 'Not available';
        }

        return match ($format) {
            'datetime' => CarbonImmutable::parse($value)->setTimezone(ReportPeriod::TIMEZONE)->format('M j, Y, g:i A'),
            'money', 'hours' => number_format((float) $value, 2, '.', ''),
            'rating' => number_format((float) $value, 1, '.', '').' / 5',
            default => $value,
        };
    }

    /** @param resource $output */
    private function row($output, array $cells): void
    {
        $safe = array_map(fn ($cell) => is_string($cell) && ! is_numeric($cell) && preg_match('/^[\x00-\x20]*[=+@-]/', $cell) ? "'".$cell : $cell, $cells);
        fputcsv($output, $safe, ',', '"', '', "\r\n");
    }
}
