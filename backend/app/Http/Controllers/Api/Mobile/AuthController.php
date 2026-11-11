<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\Auth\ResendMobileRegistrationRequest;
use App\Http\Requests\Auth\VerifyMobileRegistrationRequest;
use App\Http\Resources\UserResource;
use App\Services\AuthService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly AuthService $authService) {}

    public function register(RegisterRequest $request): JsonResponse
    {
        $result = $this->authService->beginRegistration($request->validated(), (string) $request->ip());

        return $this->success('Verification code sent.', [
            ...$result,
        ], 202)->header('Cache-Control', 'no-store');
    }

    public function verifyRegistration(VerifyMobileRegistrationRequest $request): JsonResponse
    {
        $result = $this->authService->verifyRegistration(
            $request->validated('registration_id'),
            $request->validated('code'),
        );

        return $this->created('Registration successful.', [
            'tokenType' => 'Bearer',
            'token' => $result['token'],
            'user' => new UserResource($result['user']),
        ])->header('Cache-Control', 'no-store');
    }

    public function resendRegistration(ResendMobileRegistrationRequest $request): JsonResponse
    {
        $result = $this->authService->resendRegistrationCode($request->validated('registration_id'), (string) $request->ip());

        return $this->success('Verification code sent.', $result)->header('Cache-Control', 'no-store');
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $result = $this->authService->login($request->validated());

        return $this->success('Login successful.', [
            'tokenType' => 'Bearer',
            'token' => $result['token'],
            'user' => new UserResource($result['user']),
        ])->header('Cache-Control', 'no-store');
    }

    public function logout(Request $request): JsonResponse
    {
        $this->authService->logout($request->user());

        return $this->noData('Logged out successfully.');
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load(['customerProfile', 'roles']);

        return $this->success('Authenticated user fetched successfully.', [
            'user' => new UserResource($user),
        ]);
    }
}
