<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Dashboard\DashboardRequest;
use App\Services\ReportService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly ReportService $reportService) {}

    public function __invoke(DashboardRequest $request): JsonResponse
    {
        return $this->success(
            'Dashboard fetched successfully.',
            $this->reportService->dashboardData(
                $request->validated('start'),
                $request->validated('end'),
                $request->user()?->can('manage bookings') ?? false
            )
        );
    }
}
