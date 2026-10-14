<?php

namespace App\Services;

use App\Models\Geofence;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class GeofenceTemplateService
{
    public function create(array $attributes, User $actor): Geofence
    {
        app(GeofenceGeometryService::class)->assertValid($attributes);

        return Geofence::create([
            ...$attributes,
            'created_by' => $actor->id,
        ]);
    }

    public function update(Geofence $geofence, array $attributes): Geofence
    {
        app(GeofenceGeometryService::class)->assertValid($attributes);
        $geofence->update($attributes);

        return $geofence->fresh();
    }

    public function setActive(Geofence $geofence, bool $isActive): Geofence
    {
        $geofence->update(['is_active' => $isActive]);

        return $geofence->fresh();
    }

    public function delete(Geofence $geofence): bool
    {
        return DB::transaction(function () use ($geofence) {
            $geofence = Geofence::query()->lockForUpdate()->findOrFail($geofence->id);

            return (bool) $geofence->delete();
        });
    }
}
