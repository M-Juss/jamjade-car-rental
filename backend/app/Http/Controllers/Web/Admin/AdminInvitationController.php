<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Invitation\InviteAdminRequest;
use App\Http\Resources\Admin\PersonnelResource;
use App\Models\User;
use App\Services\AdminInvitationService;
use App\Support\AccountPasswordRules;
use App\Support\ValidationPatterns;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\Request;

class AdminInvitationController extends Controller
{
    use ApiResponseTrait;

    public function index()
    {
        $users = User::role('admin')->whereDoesntHave('roles', fn ($query) => $query->where('name', 'owner'))
            ->has('roles', '=', 1)->with('roles')->orderBy('name')->get();

        return $this->success('Admins fetched.', ['accounts' => PersonnelResource::collection($users)]);
    }

    public function store(InviteAdminRequest $request, AdminInvitationService $service)
    {
        $service->send($request->validated('email'), $request->user());

        return $this->success('Admin invitation sent.');
    }

    public function cancel(Request $request, int $invitation, AdminInvitationService $service)
    {
        $service->cancel($invitation, $request->user());

        return $this->success('Invitation cancelled.');
    }

    public function revoke(Request $request, User $user, AdminInvitationService $service)
    {
        $service->revoke($user, $request->user());

        return $this->success('Admin access revoked.');
    }

    public function show(string $token, AdminInvitationService $service)
    {
        return view('auth.accept-admin-invitation', ['invitation' => $service->invitation($token)]);
    }

    public function accept(Request $request, string $token, AdminInvitationService $service)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160', 'regex:'.ValidationPatterns::PERSON_NAME],
            'password' => [...AccountPasswordRules::required(), 'confirmed'],
        ]);
        $service->accept($token, $data);

        return view('auth.accept-admin-invitation', ['accepted' => true]);
    }
}
