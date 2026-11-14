<?php

namespace App\Http\Middleware;

use App\Services\OperationalErrorService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class RecordBusinessFailure
{
    public function handle(Request $request, Closure $next): Response
    {
        try {
            $response = $next($request);
        } catch (Throwable $exception) {
            if (! $exception instanceof HttpExceptionInterface || $exception->getStatusCode() >= 500) {
                // Expected validation errors are handled by the form, not the audit log.
                if (! $exception instanceof ValidationException) {
                    $this->record($request);
                }
            }
            throw $exception;
        }
        if ($response->getStatusCode() >= 500) {
            $this->record($request);
        }

        return $response;
    }

    private function record(Request $request): void
    {
        if (! $request->user() || $request->isMethod('GET') || $request->isMethod('HEAD') || $request->attributes->get('audit_failure_recorded')) {
            return;
        }
        $path = $request->path();
        $category = match (true) {
            (bool) preg_match('#^(admin|staff)/(personnel|admins)(/|$)#', $path) => 'personnel',
            (bool) preg_match('#^(admin|staff)/(vehicles|vehicle)(/|$)#', $path) => 'vehicles',
            (bool) preg_match('#^(admin|staff)/maintenance(/|$)#', $path) => 'maintenance',
            (bool) preg_match('#^(admin|staff)/(fee-pricing|delivery-pricing|late-return-pricing|owner-profile|vehicle-configuration)(/|$)#', $path) => 'settings',
            (bool) preg_match('#^(admin|staff)/document-verification(/|$)#', $path) => 'documents',
            // Nested telematics, GPS and research routes deliberately do not match.
            (bool) preg_match('#^(admin|staff|api/mobile)/bookings(?:/\d+)?(?:/(confirm|reject|cancel|complete|payments|refund))?$#', $path) => 'booking',
            default => null,
        };
        if ($category) {
            app(OperationalErrorService::class)->record($category);
        }
    }
}
