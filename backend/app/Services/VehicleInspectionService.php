<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\VehicleConditionUpdateReason;
use App\Enums\VehicleInspectionSignerType;
use App\Enums\VehicleInspectionStatus;
use App\Enums\VehicleInspectionType;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleInspection;
use App\Support\VehicleInspectionDefinition;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class VehicleInspectionService
{
    private const SIGNATURE_DIRECTORY = 'vehicle-inspection-signatures';

    private const MAX_SIGNATURE_BYTES = 1024 * 1024;

    public function storePersonnelSignature(
        string $dataUrl,
        string $errorField = 'initial_condition.signature_data'
    ): string {
        [, $encoded] = array_pad(explode(',', $dataUrl, 2), 2, null);
        $binary = is_string($encoded) ? base64_decode($encoded, true) : false;

        if (! is_string($binary) || $binary === '' || strlen($binary) > self::MAX_SIGNATURE_BYTES) {
            throw ValidationException::withMessages([
                $errorField => ['Please provide a valid signature.'],
            ]);
        }

        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($binary);

        if ($mime !== 'image/png') {
            throw ValidationException::withMessages([
                $errorField => ['Please provide a valid PNG signature.'],
            ]);
        }

        $path = self::SIGNATURE_DIRECTORY.'/'.now()->format('Y/m').'/'.Str::uuid().'.png';

        if (! Storage::disk('local')->put($path, $binary)) {
            throw new RuntimeException('Unable to store the vehicle inspection signature.');
        }

        return $path;
    }

    public function deleteSignature(?string $path): void
    {
        if (is_string($path) && str_starts_with($path, self::SIGNATURE_DIRECTORY.'/')) {
            Storage::disk('local')->delete($path);
        }
    }

    public function createInitial(
        Vehicle $vehicle,
        array $condition,
        User $user,
        string $signaturePath,
        bool $legacySetup = false
    ): VehicleInspection {
        if ($vehicle->current_condition_inspection_id !== null || $vehicle->inspections()->where('type', VehicleInspectionType::Initial)->exists()) {
            throw ValidationException::withMessages([
                'condition' => ['The initial vehicle condition has already been configured.'],
            ]);
        }

        $inspection = $vehicle->inspections()->create([
            'type' => VehicleInspectionType::Initial,
            'status' => VehicleInspectionStatus::Draft,
            'odometer' => $condition['odometer'],
            'fuel_level' => $condition['fuel_level'],
            'comments' => $condition['comments'] ?? null,
            'created_by' => $user->id,
        ]);

        foreach (VehicleInspectionDefinition::checklist() as $category => $definitions) {
            foreach ($definitions as $key => $label) {
                $inspection->items()->create([
                    'category' => $category,
                    'item_key' => $key,
                    'item_label' => $label,
                    'value' => (bool) $condition['checklist'][$category][$key],
                ]);
            }
        }

        foreach ($condition['markers'] as $marker) {
            $inspection->markers()->create($marker);
        }

        $signature = $inspection->signatures()->create([
            'signer_type' => VehicleInspectionSignerType::Personnel,
            'user_id' => $user->id,
            'signer_name' => $user->name,
            'signature_path' => $signaturePath,
            'signed_at' => now(),
        ]);

        activity()
            ->causedBy($user)
            ->performedOn($inspection)
            ->event('initial_vehicle_condition_created')
            ->log('Initial vehicle condition created.');

        activity()
            ->causedBy($user)
            ->performedOn($signature)
            ->event('vehicle_inspection_signature_recorded')
            ->log('Personnel signature recorded for vehicle inspection.');

        $inspection->update([
            'status' => VehicleInspectionStatus::Finalized,
            'finalized_at' => now(),
        ]);

        activity()
            ->causedBy($user)
            ->performedOn($inspection)
            ->event('initial_vehicle_condition_finalized')
            ->log('Initial vehicle condition finalized.');

        $vehicle->update(['current_condition_inspection_id' => $inspection->id]);

        activity()
            ->causedBy($user)
            ->performedOn($vehicle)
            ->event('current_vehicle_condition_assigned')
            ->withProperties(['inspection_id' => $inspection->id])
            ->log('Current vehicle condition assigned.');

        if ($legacySetup) {
            activity()
                ->causedBy($user)
                ->performedOn($vehicle)
                ->event('legacy_vehicle_initial_condition_configured')
                ->withProperties(['inspection_id' => $inspection->id])
                ->log('Initial condition configured for an existing vehicle.');
        }

        return $inspection->fresh($this->detailRelations());
    }

    public function configureInitial(Vehicle $vehicle, array $condition, User $user): VehicleInspection
    {
        $signaturePath = $this->storePersonnelSignature($condition['signature_data'], 'condition.signature_data');

        try {
            return DB::transaction(function () use ($vehicle, $condition, $user, $signaturePath) {
                $lockedVehicle = Vehicle::query()->lockForUpdate()->findOrFail($vehicle->id);

                return $this->createInitial($lockedVehicle, $condition, $user, $signaturePath, true);
            });
        } catch (\Throwable $exception) {
            $this->deleteSignature($signaturePath);

            throw $exception;
        }
    }

    public function updateCurrentCondition(
        Vehicle $vehicle,
        array $condition,
        string $reason,
        ?string $notes,
        User $user,
        ?callable $afterFinalized = null
    ): VehicleInspection {
        $signaturePath = $this->storePersonnelSignature($condition['signature_data'], 'condition.signature_data');

        try {
            return DB::transaction(function () use ($vehicle, $condition, $reason, $notes, $user, $signaturePath, $afterFinalized) {
                $lockedVehicle = Vehicle::query()->lockForUpdate()->findOrFail($vehicle->id);

                if ($lockedVehicle->bookings()->where('status', BookingStatus::Ongoing)->exists()) {
                    throw ValidationException::withMessages([
                        'condition' => ['Current condition cannot be updated while this vehicle has an ongoing rental.'],
                    ]);
                }

                $current = VehicleInspection::query()
                    ->whereKey($lockedVehicle->current_condition_inspection_id)
                    ->where('vehicle_id', $lockedVehicle->id)
                    ->where('status', VehicleInspectionStatus::Finalized)
                    ->with(['items', 'markers'])
                    ->lockForUpdate()
                    ->first();

                if (! $current) {
                    throw ValidationException::withMessages([
                        'condition' => ['Set the initial vehicle condition before recording an update.'],
                    ]);
                }

                $updateReason = VehicleConditionUpdateReason::from($reason);
                $this->validateUpdatedOdometer($current, $condition, $updateReason, $notes);

                $inspection = $lockedVehicle->inspections()->create([
                    'booking_id' => null,
                    'type' => VehicleInspectionType::ConditionUpdate,
                    'status' => VehicleInspectionStatus::Draft,
                    'odometer' => $current->odometer,
                    'fuel_level' => $current->fuel_level,
                    'comments' => $current->comments,
                    'condition_update_reason' => $updateReason,
                    'condition_update_notes' => filled($notes) ? trim($notes) : null,
                    'based_on_inspection_id' => $current->id,
                    'created_by' => $user->id,
                ]);

                foreach ($current->items as $item) {
                    $inspection->items()->create([
                        'category' => $item->category,
                        'item_key' => $item->item_key,
                        'item_label' => $item->item_label,
                        'value' => $item->value,
                        'notes' => $item->notes,
                    ]);
                }

                foreach ($current->markers as $marker) {
                    $inspection->markers()->create([
                        'sequence_number' => $marker->sequence_number,
                        'panel' => $marker->panel,
                        'x_position' => $marker->x_position,
                        'y_position' => $marker->y_position,
                        'issue_type' => $marker->issue_type,
                        'description' => $marker->description,
                    ]);
                }

                $inspection->update([
                    'odometer' => $condition['odometer'],
                    'fuel_level' => $condition['fuel_level'],
                    'comments' => $condition['comments'] ?? null,
                ]);

                foreach (VehicleInspectionDefinition::checklist() as $category => $definitions) {
                    foreach ($definitions as $key => $label) {
                        $inspection->items()->updateOrCreate(
                            ['category' => $category, 'item_key' => $key],
                            ['item_label' => $label, 'value' => (bool) $condition['checklist'][$category][$key], 'notes' => null]
                        );
                    }
                }

                $inspection->markers()->delete();
                foreach ($condition['markers'] as $marker) {
                    $inspection->markers()->create($marker);
                }

                $signature = $inspection->signatures()->create([
                    'signer_type' => VehicleInspectionSignerType::Personnel,
                    'user_id' => $user->id,
                    'signer_name' => $user->name,
                    'signature_path' => $signaturePath,
                    'signed_at' => now(),
                ]);

                activity()
                    ->causedBy($user)
                    ->performedOn($signature)
                    ->event('vehicle_inspection_signature_recorded')
                    ->log('Personnel signature recorded for vehicle condition update.');

                $inspection->update([
                    'status' => VehicleInspectionStatus::Finalized,
                    'finalized_at' => now(),
                ]);

                activity()
                    ->causedBy($user)
                    ->performedOn($inspection)
                    ->event('vehicle_condition_update_finalized')
                    ->withProperties([
                        'reason' => $updateReason->value,
                        'based_on_inspection_id' => $current->id,
                    ])
                    ->log('Vehicle condition update finalized.');

                $lockedVehicle->update(['current_condition_inspection_id' => $inspection->id]);

                activity()
                    ->causedBy($user)
                    ->performedOn($lockedVehicle)
                    ->event('current_vehicle_condition_changed')
                    ->withProperties([
                        'previous_inspection_id' => $current->id,
                        'inspection_id' => $inspection->id,
                        'reason' => $updateReason->value,
                    ])
                    ->log('Current vehicle condition changed.');

                if ($afterFinalized) {
                    $afterFinalized($inspection);
                }

                return $inspection->fresh($this->detailRelations());
            });
        } catch (\Throwable $exception) {
            $this->deleteSignature($signaturePath);

            throw $exception;
        }
    }

    public function current(Vehicle $vehicle): ?VehicleInspection
    {
        return $vehicle->currentCondition()->with($this->detailRelations())->first();
    }

    public function history(Vehicle $vehicle, int $perPage = 20): LengthAwarePaginator
    {
        return $vehicle->inspections()
            ->with(['creator:id,name', 'booking:id,booking_code'])
            ->latest('finalized_at')
            ->latest('id')
            ->paginate($perPage);
    }

    public function findForVehicle(Vehicle $vehicle, VehicleInspection $inspection): VehicleInspection
    {
        abort_unless($inspection->vehicle_id === $vehicle->id, 404);

        return $inspection->load($this->detailRelations());
    }

    private function validateUpdatedOdometer(
        VehicleInspection $current,
        array $condition,
        VehicleConditionUpdateReason $reason,
        ?string $notes
    ): void {
        if ((int) $condition['odometer'] >= $current->odometer) {
            return;
        }

        if ($reason !== VehicleConditionUpdateReason::CorrectionReinspection) {
            throw ValidationException::withMessages([
                'condition.odometer' => ['The odometer cannot be lower than the current condition unless this is a correction or reinspection.'],
            ]);
        }

        if (blank($notes)) {
            throw ValidationException::withMessages([
                'notes' => ['Notes are required when correcting the odometer to a lower reading.'],
            ]);
        }
    }

    /** @return list<string> */
    private function detailRelations(): array
    {
        return [
            'items',
            'markers',
            'signatures.user:id,name',
            'creator:id,name',
            'booking:id,booking_code',
            'basedOnInspection:id,type,finalized_at',
        ];
    }
}
