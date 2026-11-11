<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use App\Services\RcResearchAccessService;
use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

class RestrictRcResearchToken
{
    public function __construct(private readonly RcResearchAccessService $research) {}

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->user()?->currentAccessToken();
        $researchToken = $token instanceof PersonalAccessToken
            && in_array(RcResearchAccessService::TOKEN_ABILITY, $token->abilities ?? [], true);

        if (! $researchToken && ! $request->routeIs('mobile.rc-research.*')) {
            return $next($request);
        }

        // Keep revocation available even after RC mode or the Admin role is removed.
        if ($researchToken && $request->routeIs('mobile.logout')) {
            return $next($request);
        }

        // Stateful web sessions intentionally cannot authorize this mobile area.
        abort_unless($researchToken && $request->bearerToken()
            && $token->abilities === [RcResearchAccessService::TOKEN_ABILITY]
            && $this->research->enabled()
            && $request->user()->hasRole(UserRole::Admin->value), 403, 'Data Collection access is unavailable.');

        abort_unless($request->routeIs('mobile.rc-research.*', 'mobile.me'), 403,
            'This session is limited to Data Collection.');

        return $next($request);
    }
}
