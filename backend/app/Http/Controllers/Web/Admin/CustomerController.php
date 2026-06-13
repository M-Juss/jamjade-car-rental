<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    use ApiResponseTrait;

    public function index(Request $request): JsonResponse
    {
        $customers = User::role('customer')
            ->with(['customerProfile', 'roles'])
            ->withCount(['bookings'])
            ->when($request->string('search')->toString(), function ($query, string $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('phone_number', 'like', "%{$search}%");
                });
            })
            ->latest()
            ->paginate((int) $request->integer('per_page', 15));

        return $this->paginated('Customers fetched successfully.', $customers, UserResource::class);
    }

    public function show(User $customer): JsonResponse
    {
        abort_unless($customer->hasRole('customer'), 404);

        return $this->success(
            'Customer fetched successfully.',
            new UserResource($customer->load(['customerProfile', 'documents', 'bookings.vehicle.images', 'roles']))
        );
    }
}
