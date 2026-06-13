<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Services\ReportService;
use App\Traits\ApiResponseTrait;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly ReportService $reportService) {}

    public function index(Request $request): JsonResponse
    {
        $range = $this->range($request);

        return $this->success(
            'Reports fetched successfully.',
            $this->reportService->analytics($range)
        );
    }

    public function pdf(Request $request)
    {
        $range = $this->range($request);
        $report = $this->reportService->analytics($range);

        return Pdf::loadView('pdf.reports.summary', [
            'report' => $report,
            'generatedAt' => now(),
        ])->download('jamjade-report-'.$range.'.pdf');
    }

    public function excel(Request $request): StreamedResponse
    {
        $range = $this->range($request);
        $report = $this->reportService->analytics($range);

        return response()->streamDownload(function () use ($report) {
            $output = fopen('php://output', 'w');

            fputcsv($output, ['Booking ID', 'Customer', 'Vehicle', 'Rental Date', 'Return Date', 'Total Cost', 'Status']);

            foreach ($report['bookings'] as $booking) {
                fputcsv($output, [
                    $booking['bookingId'],
                    $booking['customer'],
                    $booking['vehicle'],
                    $booking['rentalDate'],
                    $booking['returnDate'],
                    $booking['totalCost'],
                    $booking['status'],
                ]);
            }

            fclose($output);
        }, 'jamjade-report-'.$range.'.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    private function range(Request $request): string
    {
        $range = $request->string('range', '12_months')->toString();

        return in_array($range, ['6_months', '12_months', 'this_year', 'all_time'], true)
            ? $range
            : '12_months';
    }
}
