<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Services\AdminAccessService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly AdminAccessService $access) {}

    public function login(Request $request): JsonResponse
    {
        $request->merge([
            'email' => strtolower(trim((string) $request->input('email'))),
        ]);

        $credentials = $request->validate([
            'email' => ['required', 'email', 'max:160'],
            'password' => ['required', 'string', 'max:255'],
        ]);

        if (! Auth::attempt($credentials, (bool) $request->boolean('remember'))) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $user = $request->user()->load('roles');

        if (! $user->is_active) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            throw ValidationException::withMessages([
                'email' => ['This account is inactive. Contact the owner to restore access.'],
            ]);
        }

        if (! $this->hasAdminAccess($user)) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            throw ValidationException::withMessages([
                'email' => ['This account does not have web admin access.'],
            ]);
        }

        $request->session()->regenerate();
        $user->forceFill(['last_login_at' => now()])->save();

        return $this->success('Admin login successful.', [
            'user' => new UserResource($user->fresh()->load('roles')),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return $this->success('Authenticated user fetched.', [
            'user' => new UserResource($request->user()->load('roles')),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return $this->noData('Admin logout successful.');
    }

    private function hasAdminAccess($user): bool
    {
        if ($user->hasRole('owner')) {
            return true;
        }

        $adminPermissions = $this->access->modules(assignableOnly: true)
            ->pluck('permission');

        return $user->getAllPermissions()
            ->pluck('name')
            ->intersect($adminPermissions)
            ->isNotEmpty();
    }
}
