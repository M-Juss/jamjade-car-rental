<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Telematics\StoreGeofenceRequest;
use App\Http\Requests\Telematics\UpdateGeofenceRequest;
use App\Http\Resources\GeofenceResource;
use App\Models\Geofence;
use App\Services\GeofenceTemplateService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class GeofenceController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly GeofenceTemplateService $service) {}

    public function index(): JsonResponse
    {
        $query = Geofence::query();
        if (request()->boolean('include_deleted')) {
            $query->withTrashed();
        }
        $geofences = $query
            ->with('creator:id,name')
            ->withCount('bookingSnapshots')
            ->orderByDesc('is_active')
            ->orderBy('name')
            ->get();

        return $this->success('Default monitoring zones fetched successfully.', GeofenceResource::collection($geofences));
    }

    public function store(StoreGeofenceRequest $request): JsonResponse
    {
        return $this->created(
            'Default monitoring zone created successfully.',
            new GeofenceResource($this->service->create($request->validated(), $request->user())->load('creator:id,name')->loadCount('bookingSnapshots'))
        );
    }

    public function update(UpdateGeofenceRequest $request, Geofence $geofence): JsonResponse
    {
        return $this->success(
            'Default monitoring zone updated successfully.',
            new GeofenceResource($this->service->update($geofence, $request->validated())->load('creator:id,name')->loadCount('bookingSnapshots'))
        );
    }

    public function activate(Geofence $geofence): JsonResponse
    {
        return $this->success(
            'Default monitoring zone activated successfully.',
            new GeofenceResource($this->service->setActive($geofence, true)->load('creator:id,name')->loadCount('bookingSnapshots'))
        );
    }

    public function deactivate(Geofence $geofence): JsonResponse
    {
        return $this->success(
            'Default monitoring zone deactivated successfully.',
            new GeofenceResource($this->service->setActive($geofence, false)->load('creator:id,name')->loadCount('bookingSnapshots'))
        );
    }

    public function destroy(Geofence $geofence): JsonResponse
    {
        $this->service->delete($geofence);

        return $this->success('Default monitoring zone moved to archived zones.', [
            'id' => (string) $geofence->id,
            'isDeleted' => true,
        ]);
    }
}
