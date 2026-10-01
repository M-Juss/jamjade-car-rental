<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Personnel\ListPersonnelRequest;
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
        $users = $this->personnel->accounts($request->validated());

        return $this->success('Personnel fetched successfully.', [
            'summary' => $this->personnel->summary(),
            'users' => PersonnelResource::collection($users->getCollection()),
            'roles' => [
                ['name' => 'staff', 'label' => 'Staff'],
                ['name' => 'driver', 'label' => 'Driver'],
            ],
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
            'user' => new PersonnelResource($this->personnel->create($request->validated())),
        ]);
    }

    public function update(UpdatePersonnelRequest $request, User $user): JsonResponse
    {
        return $this->success('Personnel account updated successfully.', [
            'user' => new PersonnelResource($this->personnel->update($user, $request->validated())),
        ]);
    }
}
