<?php

namespace App\Services;

use App\Enums\RentalType;
use App\Enums\VehicleInspectionSignerType;
use App\Enums\VehicleInspectionStatus;
use App\Enums\VehicleInspectionType;
use App\Models\Booking;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleInspection;
use App\Support\VehicleInspectionDefinition;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BookingInspectionService
{
    public function __construct(
        private readonly VehicleInspectionService $inspections,
        private readonly RentalReadinessService $readiness,
        private readonly NotificationService $notifications
    ) {}

    public function finalizeOutgoing(Booking $booking, array $condition, string $operatorSignature, User $actor): VehicleInspection
    {
        $this->readiness->assertOutgoingAllowed($booking);

        return $this->finalize($booking, VehicleInspectionType::Outgoing, $condition, $operatorSignature, $actor);
    }

    public function finalizeIncoming(Booking $booking, array $condition, string $operatorSignature, User $actor): VehicleInspection
    {
        $this->readiness->assertIncomingAllowed($booking);

        return $this->finalize($booking, VehicleInspectionType::Incoming, $condition, $operatorSignature, $actor);
    }

    private function finalize(
        Booking $booking,
        VehicleInspectionType $type,
        array $condition,
        string $operatorSignature,
        User $actor
    ): VehicleInspection {
        $personnelPath = $this->inspections->storePersonnelSignature($condition['signature_data'], 'condition.signature_data');
        $operatorPath = $this->inspections->storePersonnelSignature($operatorSignature, 'operator_signature_data');

        try {
            return DB::transaction(function () use ($booking, $type, $condition, $actor, $personnelPath, $operatorPath) {
                $booking = Booking::query()->with(['user', 'assignedDriver', 'assignment'])->lockForUpdate()->findOrFail($booking->id);
                $vehicle = Vehicle::query()->lockForUpdate()->findOrFail($booking->vehicle_id);

                if ($booking->vehicleInspections()->where('type', $type)->exists()) {
                    throw ValidationException::withMessages(['inspection' => ["The {$type->label()} inspection already exists."]]);
                }

                $source = $type === VehicleInspectionType::Outgoing
                    ? VehicleInspection::query()->whereKey($vehicle->current_condition_inspection_id)
                        ->where('vehicle_id', $vehicle->id)->where('status', VehicleInspectionStatus::Finalized)->with(['items', 'markers'])->lockForUpdate()->first()
                    : $booking->vehicleInspections()->where('type', VehicleInspectionType::Outgoing)
                        ->where('status', VehicleInspectionStatus::Finalized)->with(['items', 'markers'])->lockForUpdate()->first();

                if (! $source) {
                    throw ValidationException::withMessages(['inspection' => [
                        $type === VehicleInspectionType::Outgoing
                            ? 'Set a finalized Current Condition before Outgoing Inspection.'
                            : 'Finalize Outgoing Inspection before Incoming Inspection.',
                    ]]);
                }
                if ((int) $condition['odometer'] < $source->odometer) {
                    throw ValidationException::withMessages(['condition.odometer' => ['The odometer cannot be lower than the inspection baseline.']]);
                }

                $inspection = $booking->vehicleInspections()->create([
                    'vehicle_id' => $vehicle->id,
                    'type' => $type,
                    'status' => VehicleInspectionStatus::Draft,
                    'odometer' => $source->odometer,
                    'fuel_level' => $source->fuel_level,
                    'comments' => $source->comments,
                    'based_on_inspection_id' => $source->id,
                    'created_by' => $actor->id,
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
                $inspection->forceFill([
                    'odometer' => $condition['odometer'],
                    'fuel_level' => $condition['fuel_level'],
                    'comments' => $condition['comments'] ?? null,
                ])->save();

                $operator = $booking->rental_type === RentalType::SelfDrive ? $booking->user : $booking->assignedDriver;
                if (! $operator) {
                    throw ValidationException::withMessages(['inspection' => ['The required inspection operator is not assigned.']]);
                }
                $operatorType = $booking->rental_type === RentalType::SelfDrive
                    ? VehicleInspectionSignerType::Renter
                    : VehicleInspectionSignerType::Driver;

                $inspection->signatures()->create([
                    'signer_type' => VehicleInspectionSignerType::Personnel,
                    'user_id' => $actor->id,
                    'signer_name' => $actor->name,
                    'signature_path' => $personnelPath,
                    'signed_at' => now(),
                ]);
                $inspection->signatures()->create([
                    'signer_type' => $operatorType,
                    'user_id' => $operator->id,
                    'signer_name' => $operator->name,
                    'signature_path' => $operatorPath,
                    'signed_at' => now(),
                ]);
                $inspection->forceFill(['status' => VehicleInspectionStatus::Finalized, 'finalized_at' => now()])->save();

                if ($type === VehicleInspectionType::Outgoing) {
                    $booking->assignment()->updateOrCreate([], [
                        'calibration_status' => 'available',
                        'calibrated_by' => null,
                        'calibrated_at' => null,
                    ]);
                    $booking->unsetRelation('assignment');
                    $booking->unsetRelation('assignedDriver');
                } else {
                    $vehicle->forceFill(['current_condition_inspection_id' => $inspection->id])->save();
                }

                activity()->causedBy($actor)->performedOn($inspection)
                    ->event($type === VehicleInspectionType::Outgoing ? 'booking_outgoing_inspection_finalized' : 'booking_incoming_inspection_finalized')
                    ->withProperties(['booking_id' => $booking->id, 'based_on_inspection_id' => $source->id])
                    ->log("Booking {$type->label()} inspection finalized.");

                if ($type === VehicleInspectionType::Outgoing) {
                    $this->notifications->createForUser($operator, 'trip', 'Calibration available',
                        "Calibration is now available for booking {$booking->booking_code}.", [
                            'booking_id' => $booking->id, 'action' => 'start_calibration', 'action_label' => 'Start Calibration',
                        ]);
                }

                return $inspection->fresh(['items', 'markers', 'signatures.user:id,name', 'creator:id,name', 'booking:id,booking_code', 'basedOnInspection']);
            });
        } catch (\Throwable $exception) {
            $this->inspections->deleteSignature($personnelPath);
            $this->inspections->deleteSignature($operatorPath);
            throw $exception;
        }
    }
}
