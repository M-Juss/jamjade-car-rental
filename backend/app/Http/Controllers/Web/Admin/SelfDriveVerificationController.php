<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Document\ListSelfDriveCustomersRequest;
use App\Http\Resources\SelfDriveCustomerResource;
use App\Models\CustomerDocument;
use App\Models\User;
use App\Services\SelfDriveVerificationService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class SelfDriveVerificationController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly SelfDriveVerificationService $verification) {}

    public function index(ListSelfDriveCustomersRequest $request): JsonResponse
    {
        $customers = User::role('customer');
        $total = (clone $customers)->count();
        $eligible = $this->verification->eligibleCustomers(clone $customers)->count();
        $search = $request->validated('search');

        $customers->when($search, fn ($query, string $value) => $query->where(fn ($matching) => $matching
            ->where('name', 'like', "%{$value}%")
            ->orWhere('email', 'like', "%{$value}%")
            ->orWhere('phone_number', 'like', "%{$value}%")));

        if ($request->validated('eligibility') === 'eligible') {
            $this->verification->eligibleCustomers($customers);
        } elseif ($request->validated('eligibility') === 'not_eligible') {
            $customers->whereNotIn('users.id', $this->verification
                ->eligibleCustomers(User::role('customer')->select('users.id')));
        }

        $page = $customers->with(['customerProfile', 'documents'])
            ->orderByDesc('users.created_at')
            ->orderByDesc('users.id')
            ->paginate($request->integer('per_page', 15));

        return $this->success('Self-drive customers fetched successfully.',
            SelfDriveCustomerResource::collection($page->getCollection())->resolve(), 200, [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'summary' => ['total' => $total, 'eligible' => $eligible, 'notEligible' => $total - $eligible],
            ]);
    }

    public function show(User $customer): JsonResponse
    {
        abort_unless($customer->hasRole('customer'), 404);

        $customer->load(['customerProfile', 'documents' => fn ($query) => $query
            ->whereIn('document_type', CustomerDocument::ALLOWED_DOCUMENT_TYPES)
            ->with(['reviewer', 'files'])]);

        return $this->success('Self-drive customer fetched successfully.', new SelfDriveCustomerResource($customer));
    }
}
