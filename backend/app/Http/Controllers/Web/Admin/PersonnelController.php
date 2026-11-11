<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Personnel\DeletePersonnelRequest;
use App\Http\Requests\Admin\Personnel\ListPersonnelRequest;
use App\Http\Requests\Admin\Personnel\StoreAdminRequest;
use App\Http\Requests\Admin\Personnel\StorePersonnelRequest;
use App\Http\Requests\Admin\Personnel\UpdatePersonnelRequest;
use App\Http\Resources\Admin\PersonnelResource;
use App\Models\User;
use App\Services\PersonnelService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class PersonnelController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly PersonnelService $personnel) {}

    public function index(ListPersonnelRequest $request): JsonResponse
    {
        $users = $this->personnel->accounts($request->validated(), $request->user());

        return $this->success('Personnel fetched successfully.', [
            'summary' => $this->personnel->summary($request->user()),
            'users' => PersonnelResource::collection($users->getCollection()),
            'roles' => $request->user()->hasRole('owner')
                ? [['name' => 'staff', 'label' => 'Staff'], ['name' => 'driver', 'label' => 'Driver'], ['name' => 'admin', 'label' => 'Admin']]
                : ($request->user()->hasRole('admin')
                    ? [['name' => 'staff', 'label' => 'Staff'], ['name' => 'driver', 'label' => 'Driver']]
                    : [['name' => 'driver', 'label' => 'Driver']]),
            'pagination' => [
                'currentPage' => $users->currentPage(),
                'lastPage' => $users->lastPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    public function store(StorePersonnelRequest $request): JsonResponse
    {
        return $this->created('Personnel account created successfully.', [
            'user' => new PersonnelResource($this->personnel->create($request->validated(), $request->user())),
        ]);
    }

    public function storeAdmin(StoreAdminRequest $request): JsonResponse
    {
        return $this->created('Admin account created successfully.', [
            'user' => new PersonnelResource($this->personnel->create($request->validated(), $request->user())),
        ]);
    }

    public function update(UpdatePersonnelRequest $request, User $user): JsonResponse
    {
        return $this->success('Personnel account updated successfully.', [
            'user' => new PersonnelResource($this->personnel->update($user, $request->validated(), $request->user())),
        ]);
    }

    public function destroy(DeletePersonnelRequest $request, User $user): JsonResponse
    {
        $this->personnel->delete($user, $request->user());

        return $this->success('Personnel account deleted successfully.');
    }
}
