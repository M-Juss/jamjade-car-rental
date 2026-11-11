<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Services\ModelExplorerService;
use App\Services\RcResearchAccessService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class ModelExplorerController extends Controller
{
    use ApiResponseTrait;

    public function __invoke(Request $request, RcResearchAccessService $access, ModelExplorerService $explorer, ?string $example = null): JsonResponse
    {
        abort_unless($access->enabled(), 403, 'Model Explorer is unavailable.');
        abort_unless(app()->isLocal() || config('telematics.hosted_rc_demo'), 503, 'Model Explorer is unavailable.');
        try {
            $data = $example === null ? $explorer->index($request->user()) : $explorer->show($request->user(), (int) $example);
        } catch (HttpExceptionInterface $exception) {
            throw $exception;
        } catch (Throwable) {
            abort(503, 'The private model or development dataset is unavailable.');
        }

        return $this->success('Model example fetched.', $data)->header('Cache-Control', 'private, no-store');
    }
}
