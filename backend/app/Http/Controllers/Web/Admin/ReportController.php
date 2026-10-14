<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Report\ReportRequest;
use App\Services\ReportService;
use App\Traits\ApiResponseTrait;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly ReportService $reportService) {}

    public function index(ReportRequest $request): JsonResponse
    {
        $range = $this->range($request);

        return $this->success(
            'Reports fetched successfully.',
            $this->reportService->analytics($range)
        );
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
