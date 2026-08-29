<?php

namespace App\Services;

use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class VehicleService
{
    private const VEHICLE_UPLOAD_DIRECTORY = 'vehicles';

    public function __construct(private readonly VehicleInspectionService $inspectionService) {}

    public function paginate(array $filters = [], int $perPage = 10): LengthAwarePaginator
    {
        return Vehicle::query()
            ->with(['images', 'features', 'dateBlockingBookings', 'scheduledMaintenanceWindows'])
            ->when($filters['search'] ?? null, function ($query, string $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('brand', 'like', "%{$search}%")
                        ->orWhere('model', 'like', "%{$search}%")
                        ->orWhere('plate_number', 'like', "%{$search}%");
                });
            })
            ->when($filters['status'] ?? null, fn ($query, string $status) => $query->where('status', $status))
            ->when($filters['brand'] ?? null, fn ($query, string $brand) => $query->where('brand', $brand))
            ->when($filters['transmission'] ?? null, fn ($query, string $transmission) => $query->where('transmission', $transmission))
            ->orderBy('brand')
            ->orderBy('model')
            ->paginate($perPage);
    }

    public function create(array $data, User $user): Vehicle
    {
        $storedImagePaths = [];
        $signaturePath = $this->inspectionService->storePersonnelSignature($data['initial_condition']['signature_data']);

        try {
            return DB::transaction(function () use ($data, $user, &$storedImagePaths, $signaturePath) {
                $vehicle = Vehicle::create($this->vehiclePayload($data));
                $this->syncRelations($vehicle, $data, $storedImagePaths);

                $this->inspectionService->createInitial(
                    $vehicle,
                    $data['initial_condition'],
                    $user,
                    $signaturePath
                );

                activity()
                    ->causedBy($user)
                    ->performedOn($vehicle)
                    ->event('vehicle_created')
                    ->log('Vehicle created by admin.');

                return $vehicle->fresh(['images', 'features', 'currentCondition']);
            });
        } catch (\Throwable $exception) {
            Storage::disk('public')->delete($storedImagePaths);
            $this->inspectionService->deleteSignature($signaturePath);

            throw $exception;
        }
    }

    public function update(Vehicle $vehicle, array $data): Vehicle
    {
        return DB::transaction(function () use ($vehicle, $data) {
            $vehicle->update($this->vehiclePayload($data));
            $storedImagePaths = [];
            $this->syncRelations($vehicle, $data, $storedImagePaths);

            activity()
                ->causedBy(auth()->user())
                ->performedOn($vehicle)
                ->event('vehicle_updated')
                ->log('Vehicle updated by admin.');

            return $vehicle->fresh(['images', 'features']);
        });
    }

    public function delete(Vehicle $vehicle): void
    {
        DB::transaction(function () use ($vehicle) {
            $vehicle->delete();

            activity()
                ->causedBy(auth()->user())
                ->performedOn($vehicle)
                ->event('vehicle_deleted')
                ->log('Vehicle soft-deleted by admin.');
        });
    }

    private function vehiclePayload(array $data): array
    {
        return collect($data)
            ->only([
                'name',
                'brand',
                'model',
                'plate_number',
                'price_per_day',
                'seats',
                'transmission',
                'fuel_type',
                'color',
                'status',
                'description',
                'is_most_booked',
            ])
            ->filter(fn ($value) => $value !== null)
            ->all();
    }

    private function syncRelations(Vehicle $vehicle, array $data, array &$storedImagePaths): void
    {
        if (array_key_exists('features', $data)) {
            $vehicle->features()->delete();

            foreach ($data['features'] ?? [] as $feature) {
                $vehicle->features()->create(['feature_name' => $feature]);
            }
        }

        if (array_key_exists('images', $data)) {
            $vehicle->images()->get()->each(fn ($image) => $this->deleteVehicleImage($image->image_path));
            $vehicle->images()->delete();

            foreach ($data['images'] ?? [] as $index => $imagePath) {
                if ($imagePath instanceof UploadedFile) {
                    $imagePath = $this->storeVehicleImage($imagePath);
                    $storedImagePaths[] = $imagePath;
                }

                if (! is_string($imagePath) || $imagePath === '') {
                    continue;
                }

                $vehicle->images()->create([
                    'image_path' => $imagePath,
                    'is_primary' => $index === 0,
                    'sort_order' => $index,
                ]);
            }
        }
    }

    private function storeVehicleImage(UploadedFile $image): string
    {
        return $image->store(self::VEHICLE_UPLOAD_DIRECTORY, 'public');
    }

    private function deleteVehicleImage(?string $path): void
    {
        if (! is_string($path) || $path === '' || preg_match('/^https?:\/\//i', $path)) {
            return;
        }

        if (str_starts_with($path, 'uploads/') || str_starts_with($path, '/uploads/')) {
            return;
        }

        Storage::disk('public')->delete($path);
    }
}
