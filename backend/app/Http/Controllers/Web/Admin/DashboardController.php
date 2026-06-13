<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Services\ReportService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly ReportService $reportService) {}

    public function __invoke(): JsonResponse
    {
        return $this->success(
            'Dashboard fetched successfully.',
            $this->reportService->dashboardData()
        );
    }
}
