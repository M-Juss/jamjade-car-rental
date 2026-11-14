<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\OperationalError\ListOperationalErrorsRequest;
use App\Http\Resources\OperationalErrorResource;
use App\Services\AuditLogService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class OperationalErrorController extends Controller
{
    use ApiResponseTrait;

    public function index(ListOperationalErrorsRequest $request, AuditLogService $audit): JsonResponse
    {
        return $this->paginated('Activity log fetched successfully.', $audit->paginate($request->validated()), OperationalErrorResource::class);
    }
}
