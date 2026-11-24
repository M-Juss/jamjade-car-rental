<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\OperationalError\ListOperationalErrorsRequest;
use App\Http\Resources\OperationalErrorResource;
use App\Services\AuditLogService;
use App\Services\TechnicalActivityService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class OperationalErrorController extends Controller
{
    use ApiResponseTrait;

    public function index(ListOperationalErrorsRequest $request, AuditLogService $audit): JsonResponse
    {
        return $this->paginated('Activity log fetched successfully.', ($request->user()->hasRole('owner') ? $audit->paginate($request->validated()) : app(TechnicalActivityService::class)->paginate($request->user(), $request->validated())), OperationalErrorResource::class);
    }
}
