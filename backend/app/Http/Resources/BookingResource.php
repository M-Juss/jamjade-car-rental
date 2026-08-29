<?php

namespace App\Http\Resources;

use App\Enums\BookingStatus;
use App\Models\CustomerDocument;
use App\Services\RentalReadinessService;
use App\Support\PublicStorageUrl;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BookingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $isManagement = (bool) $request->user()?->can('manage bookings');
        $isDriverView = $request->user()?->id === $this->assigned_driver_id
            && $request->user()?->id !== $this->user_id;
        $vehicle = $this->whenLoaded('vehicle');
        $payments = $this->whenLoaded('payments', fn () => $this->payments, collect());
        $latestPayment = collect($payments)->sortByDesc('created_at')->first();
        $paidAmount = collect($payments)->sum(fn ($payment) => (float) $payment->amount);
        $image = $this->vehicle?->images?->first()?->image_path;

        return [
            'backendId' => $this->id,
            'id' => $this->booking_code,
            'bookingCode' => $this->booking_code,
            'status' => $this->status->mobileLabel(),
            'statusKey' => $this->status->value,
            'adminStatus' => $this->status->adminLabel(),
            'vehicleId' => (string) $this->vehicle_id,
            'vehicleName' => $this->vehicle?->name,
            'brand' => $this->vehicle?->brand,
            'model' => $this->vehicle?->model,
            'image' => PublicStorageUrl::make($image),
            'rentalDate' => $this->rental_start_at?->format('F j, Y - g:i A'),
            'returnDate' => $this->rental_end_at?->format('F j, Y - g:i A'),
            'rentalStartAt' => $this->rental_start_at?->toISOString(),
            'rentalEndAt' => $this->rental_end_at?->toISOString(),
            'duration' => $this->duration_days,
            'durationDays' => $this->duration_days,
            'pickupType' => $this->pickup_location_type === 'delivery' ? 'Delivery' : 'Shop Pickup',
            'pickupLocationType' => $this->pickup_location_type,
            'pickupLocation' => $this->pickup_location,
            'deliveryTime' => $this->delivery_time
                ? CarbonImmutable::parse($this->delivery_time)->format('H:i')
                : null,
            'deliveryTimeLabel' => $this->delivery_time
                ? CarbonImmutable::parse($this->delivery_time)->format('g:i A')
                : null,
            'returnLocation' => $this->return_location,
            'driverType' => $this->rental_type->label(),
            'bookingType' => $this->rental_type->label(),
            'rentalType' => $this->rental_type->value,
            'driverOption' => $this->driver_option,
            'ownerDriverCoverage' => $this->owner_driver_coverage,
            'assignedDriver' => $this->assignedDriver ? [
                'id' => $this->assignedDriver->id,
                'name' => $this->assignedDriver->name,
                'phoneNumber' => $this->assignedDriver->phone_number,
            ] : null,
            'driverAssignedAt' => $this->driver_assigned_at?->toISOString(),
            'calibrationStatus' => $this->calibration_status,
            'calibratedAt' => $this->calibrated_at?->toISOString(),
            'returnedAt' => $this->returned_at?->toISOString(),
            'completedAt' => $this->completed_at?->toISOString(),
            'returnChargesFinalizedAt' => $this->return_charges_finalized_at?->toISOString(),
            'transmission' => $this->vehicle?->transmission,
            'fuelType' => $this->vehicle?->fuel_type,
            'seats' => $this->vehicle?->seats,
            'pricePerDay' => $isDriverView ? 0 : (float) $this->price_per_day,
            'subtotal' => $isDriverView ? 0 : (float) $this->subtotal,
            'deliveryFee' => $isDriverView ? 0 : (float) $this->delivery_fee,
            'outsideManilaFee' => $isDriverView ? 0 : (float) $this->outside_manila_fee,
            'ownerDriverFee' => $isDriverView ? 0 : (float) $this->owner_driver_fee,
            'tollFee' => $isDriverView ? 0 : (float) $this->toll_fee,
            'lateFee' => $isDriverView ? 0 : (float) $this->late_fee,
            'optionalServices' => $isDriverView ? 0 : (float) $this->add_ons_total,
            'addOns' => $isDriverView ? 0 : (float) $this->add_ons_total,
            'discount' => $isDriverView ? 0 : (float) $this->discount_total,
            'penaltyTotal' => $isDriverView ? 0 : (float) $this->penalty_total,
            'downPayment' => $isDriverView ? 0 : (float) $this->down_payment_amount,
            'totalAmount' => $isDriverView ? 0 : (float) $this->total_amount,
            'remainingBalance' => $isDriverView ? 0 : max((float) $this->remaining_balance, max((float) $this->total_amount - $paidAmount, 0)),
            'balanceDueAt' => $isDriverView ? null : $this->balance_due_at?->toISOString(),
            'confirmationEmailSentAt' => $this->confirmation_email_sent_at?->toISOString(),
            'confirmationEmailStatus' => $this->confirmation_email_status,
            'paymentStatus' => $isDriverView ? 'Private' : $this->payment_status->label(),
            'paymentStatusKey' => $isDriverView ? null : $this->payment_status->value,
            'paymentMethod' => $isDriverView ? 'N/A' : ($latestPayment?->payment_method ?? 'N/A'),
            'transactionId' => $isDriverView ? 'N/A' : ($latestPayment?->transaction_id ?? 'N/A'),
            'paidAt' => $isDriverView ? 'N/A' : ($latestPayment?->paid_at?->format('F j, Y - g:i A') ?? 'N/A'),
            'createdAt' => $this->created_at?->format('F j, Y - g:i A'),
            'notes' => $this->notes,
            'adminNotes' => $this->when($isManagement, $this->admin_notes),
            'documents' => $isDriverView ? [] : $this->documentSummary(),
            'timeline' => $this->timeline(),
            'payments' => $isDriverView ? [] : PaymentResource::collection($payments),
            'additionalCharges' => AdditionalChargeResource::collection(
                $this->whenLoaded('additionalCharges', fn () => $isManagement
                    ? $this->additionalCharges
                    : $this->additionalCharges->where('responsible_user_id', $request->user()?->id)->values())
            ),
            'inspections' => $this->when($isManagement, fn () => VehicleInspectionResource::collection($this->whenLoaded('vehicleInspections'))),
            'inspectionBaseline' => $this->when($isManagement && $this->relationLoaded('vehicle'), function () {
                $outgoing = $this->relationLoaded('vehicleInspections')
                    ? $this->vehicleInspections->first(fn ($inspection) => $inspection->type->value === 'outgoing' && $inspection->status->value === 'finalized')
                    : null;
                $baseline = $this->status === BookingStatus::Ongoing && $outgoing ? $outgoing : $this->vehicle?->currentCondition;

                return $baseline ? new VehicleInspectionResource($baseline) : null;
            }),
            'readiness' => $this->when(
                $isManagement && $this->relationLoaded('vehicleInspections') && $this->relationLoaded('vehicle'),
                fn () => app(RentalReadinessService::class)->evaluate($this->resource)
            ),
            'rentalProgress' => [
                'outgoingFinalized' => $this->relationLoaded('vehicleInspections')
                    ? $this->vehicleInspections->contains(fn ($inspection) => $inspection->type->value === 'outgoing' && $inspection->status->value === 'finalized')
                    : false,
                'calibrationStatus' => $this->calibration_status,
                'tripEnded' => $this->relationLoaded('telematicsTrips')
                    ? $this->telematicsTrips->contains(fn ($trip) => $trip->status === 'ended')
                    : false,
                'latestTripId' => $this->relationLoaded('telematicsTrips')
                    ? $this->telematicsTrips->sortByDesc('created_at')->first()?->id
                    : null,
                'latestTripStatus' => $this->relationLoaded('telematicsTrips')
                    ? $this->telematicsTrips->sortByDesc('created_at')->first()?->status
                    : null,
                'incomingFinalized' => $this->relationLoaded('vehicleInspections')
                    ? $this->vehicleInspections->contains(fn ($inspection) => $inspection->type->value === 'incoming' && $inspection->status->value === 'finalized')
                    : false,
            ],
            'customer' => $this->whenLoaded('user', function () use ($isManagement, $request) {
                if ($isManagement || $request->user()?->id === $this->user_id) {
                    return new UserResource($this->user);
                }

                if ($request->user()?->id === $this->assigned_driver_id) {
                    return [
                        'name' => $this->user->name,
                        'phoneNumber' => $this->user->phone_number,
                    ];
                }

                return null;
            }),
        ];
    }

    private function documentSummary(): array
    {
        $documents = $this->user?->documents?->keyBy('document_type') ?? collect();

        return collect(CustomerDocument::REQUIRED_SELF_DRIVE_DOCUMENTS)
            ->map(function (string $type) use ($documents) {
                $document = $documents->get($type);

                return [
                    'name' => CustomerDocument::labelFor($type),
                    'documentType' => $type,
                    'status' => $document?->status?->bookingLabel() ?? 'Missing',
                ];
            })
            ->values()
            ->all();
    }

    private function timeline(): array
    {
        $items = [
            [
                'title' => 'Booking Submitted',
                'description' => 'Your booking request has been submitted.',
                'timestamp' => $this->created_at?->format('F j, Y - g:i A') ?? '',
                'completed' => true,
            ],
            [
                'title' => 'Booking Confirmed',
                'description' => 'Your booking has been confirmed.',
                'timestamp' => $this->confirmed_at?->format('F j, Y - g:i A') ?? '',
                'completed' => in_array($this->status, [BookingStatus::Confirmed, BookingStatus::Ongoing, BookingStatus::Returned, BookingStatus::Completed], true),
            ],
            [
                'title' => 'Rental Active',
                'description' => 'Your rental is currently active.',
                'timestamp' => $this->started_at?->format('F j, Y - g:i A') ?? '',
                'completed' => in_array($this->status, [BookingStatus::Ongoing, BookingStatus::Returned, BookingStatus::Completed], true),
            ],
            [
                'title' => 'Vehicle Returned',
                'description' => 'The vehicle return and Incoming Inspection are complete.',
                'timestamp' => $this->returned_at?->format('F j, Y - g:i A') ?? '',
                'completed' => in_array($this->status, [BookingStatus::Returned, BookingStatus::Completed], true),
            ],
            [
                'title' => 'Completed',
                'description' => 'Your rental has been completed.',
                'timestamp' => $this->completed_at?->format('F j, Y - g:i A') ?? '',
                'completed' => $this->status === BookingStatus::Completed,
            ],
        ];

        if ($this->status === BookingStatus::Rejected) {
            return [
                $items[0],
                [
                    'title' => 'Booking Rejected',
                    'description' => $this->admin_notes ?: 'Your booking was rejected.',
                    'timestamp' => $this->rejected_at?->format('F j, Y - g:i A') ?? '',
                    'completed' => true,
                ],
            ];
        }

        if ($this->status === BookingStatus::Cancelled) {
            $items[] = [
                'title' => 'Booking Cancelled',
                'description' => $this->admin_notes ?: 'This booking was cancelled.',
                'timestamp' => $this->cancelled_at?->format('F j, Y - g:i A') ?? '',
                'completed' => true,
            ];
        }

        return $items;
    }
}
