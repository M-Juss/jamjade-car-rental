<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangeAccountPasswordRequest;
use App\Http\Requests\Auth\UpdateAccountEmailRequest;
use App\Http\Resources\UserResource;
use App\Services\AuthService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class AccountController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly AuthService $authService) {}

    public function updateEmail(UpdateAccountEmailRequest $request): JsonResponse
    {
        $user = $this->authService->updateAccountEmail($request->user(), $request->validated());

        return $this->success('Sign-in email updated successfully.', new UserResource($user));
    }

    public function changePassword(ChangeAccountPasswordRequest $request): JsonResponse
    {
        $this->authService->changeAccountPassword($request->user(), $request->validated());

        return $this->noData('Password updated. Please sign in again.');
    }
}
