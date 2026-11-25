<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Report\ReportAnalyticsRequest;
use App\Http\Requests\Admin\Report\ReportRequest;
use App\Http\Resources\DrivingOperatorResource;
use App\Services\RentalDrivingOverviewService;
use App\Services\ReportAnalyticsService;
use App\Services\ReportCsvExportService;
use App\Services\ReportService;
use App\Support\ReportPeriod;
use App\Traits\ApiResponseTrait;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        private readonly ReportService $reportService,
        private readonly ReportAnalyticsService $analytics,
    ) {}

    public function index(ReportAnalyticsRequest $request): JsonResponse
    {
        if ($request->filled('range')) {
            return $this->success('Reports fetched successfully.', $this->reportService->analytics($request->validated('range')));
        }
        $period = $request->period();
        $data = $this->analytics->analytics($request->section(), $period, $request->validated());
        if ($request->section() === 'telematics' && $request->user()->can('manage bookings') && $request->user()->can('view fleet tracker')) {
            $operators = $this->analytics->operatorsNeedingAttention($period, $request->validated());
            $data['operatorAttention'] = [
                'threshold' => RentalDrivingOverviewService::ATTENTION_GRADE_THRESHOLD,
                'operators' => DrivingOperatorResource::collection($operators->getCollection())->resolve($request),
                'page' => $operators->currentPage(), 'lastPage' => $operators->lastPage(), 'total' => $operators->total(),
            ];
        }

        return $this->success('Reports fetched successfully.', $data)->header('Cache-Control', 'private, no-store');
    }

    public function csv(ReportAnalyticsRequest $request, ReportCsvExportService $csv): StreamedResponse
    {
        if ($request->validated('export_scope') === 'all') {
            $period = $request->period();

            return response()->streamDownload(function () use ($request, $period, $csv) {
                $output = fopen('php://output', 'w');
                try {
                    $csv->write($output, $request->user(), $period, $request->validated());
                } finally {
                    fclose($output);
                }
            }, $csv->filename($period), [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Access-Control-Expose-Headers' => 'Content-Disposition',
                'Cache-Control' => 'private, no-store',
            ]);
        }

        $section = $request->section();
        $period = $request->period();
        $report = $this->analytics->export($section, $period, $request->validated());
        $dates = $period->description();

        return response()->streamDownload(function () use ($report) {
            $output = fopen('php://output', 'w');
            fwrite($output, "\xEF\xBB\xBF");
            fputcsv($output, array_column($report['columns'], 'label'), ',', '"', '');

            foreach ($report['rows'] as $row) {
                $cells = array_map(fn (array $column) => $this->csvCell($row[$column['key']], $column['format']), $report['columns']);
                fputcsv($output, $cells, ',', '"', '');
            }

            fclose($output);
        }, "jamjade-{$section}-{$dates['startDate']}-{$dates['endDate']}.csv", [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Access-Control-Expose-Headers' => 'Content-Disposition',
        ]);
    }

    private function csvCell(int|float|string|null $value, string $format): int|float|string
    {
        if ($value === null) {
            return '';
        }

        return match ($format) {
            'datetime' => CarbonImmutable::parse($value)->setTimezone(ReportPeriod::TIMEZONE)->toIso8601String(),
            'money', 'hours' => number_format((float) $value, 2, '.', ''),
            'text' => preg_match('/^[\x00-\x20]*[=+@-]/', $value) ? "'".$value : $value,
            default => $value,
        };
    }

    public function pdf(ReportRequest $request)
    {
        $range = $this->range($request);
        $report = $this->reportService->analytics($range);

        return Pdf::loadView('pdf.reports.summary', [
            'report' => $report,
            'generatedAt' => now(),
        ])->download('jamjade-report-'.$range.'.pdf');
    }

    public function excel(ReportRequest $request): StreamedResponse
    {
        $range = $this->range($request);
        $report = $this->reportService->analytics($range);

        return response()->streamDownload(function () use ($report) {
            $output = fopen('php://output', 'w');

            fputcsv($output, ['Booking ID', 'Customer', 'Vehicle', 'Rental Date', 'Return Date', 'Monitoring Zones', 'Total Cost', 'Status']);

            foreach ($report['bookings'] as $booking) {
                fputcsv($output, [
                    $booking['bookingId'],
                    $booking['customer'],
                    $booking['vehicle'],
                    $booking['rentalDate'],
                    $booking['returnDate'],
                    implode('; ', array_column($booking['monitoringZones'] ?? [], 'name')) ?: '—',
                    $booking['totalCost'],
                    $booking['status'],
                ]);
            }

            fclose($output);
        }, 'jamjade-report-'.$range.'.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    private function range(ReportRequest $request): string
    {
        return $request->validated('range', '12_months');
    }
}
