<?php

namespace App\Http\Resources;

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Models\CustomerDocument;
use App\Services\BookingAttentionService;
use App\Services\BookingGeofenceService;
use App\Services\BookingReturnService;
use App\Services\BookingService;
use App\Services\LocationMonitoringService;
use App\Services\RentalReadinessService;
use App\Services\TelematicsCalibrationService;
use App\Services\TelematicsOperatorService;
use App\Support\PublicStorageUrl;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BookingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // Booking details are normalized into focused child tables. Load them once
        // so the existing API response remains stable without N+1 accessor queries.
        $this->resource->loadMissing(['assignedDriver', 'deliveryQuote', 'assignment', 'terms', 'returnRecord', 'confirmationEmail', 'events', 'telematicsSetupSession', 'cancellation']);

        if ($this->relationLoaded('additionalCharges')) {
            $this->additionalCharges->loadMissing('payments');
        }

        $isManagement = (bool) $request->user()?->can('manage bookings');
        $telematicsSupported = app(TelematicsOperatorService::class)->supports($this->resource);
        $hasMonitoringDetails = $isManagement && $this->relationLoaded('bookingGeofences')
            && $telematicsSupported;
        $isDriverView = (int) $request->user()?->id === (int) $this->assignment?->driver_id
            && $request->user()?->id !== $this->user_id;
        $vehicle = $this->whenLoaded('vehicle');
        $payments = $this->whenLoaded('payments', fn () => $this->payments, collect());
        $latestPayment = collect($payments)->sortByDesc('created_at')->first();
        $paidAmount = collect($payments)->sum(fn ($payment) => (float) $payment->amount);
        $image = $this->vehicle?->images?->first()?->image_path;

        return [
            'backendId' => $this->id,
            'canReviewCancellationRefund' => $isManagement && ($request->user()?->hasRole('admin') ?? false),
            'cancellation' => $this->when(! $isDriverView, fn () => $this->cancellation ? [
                'kind' => $this->cancellation->kind,
                'reason' => $this->cancellation->reason,
                'refundAmount' => $this->cancellation->refund_amount === null ? null : (float) $this->cancellation->refund_amount,
                'refundStatus' => $this->cancellation->refunded_at ? 'refunded'
                    : ($this->cancellation->reviewed_at ? ((float) $this->cancellation->refund_amount > 0 ? 'approved' : 'declined')
                        : (in_array($this->cancellation->kind, ['no_show', 'payment_deadline'], true) ? 'not_eligible' : 'pending_review')),
                'refundReason' => $this->cancellation->refund_reason,
                'reviewedAt' => $this->cancellation->reviewed_at?->toISOString(),
                'refundedAt' => $this->cancellation->refunded_at?->toISOString(),
            ] : null),
            'id' => $this->booking_code,
            'bookingCode' => $this->booking_code,
            'canReviseUnpaid' => $request->user()?->id === $this->user_id && $this->relationLoaded('payments')
                && app(BookingService::class)->canReviseUnpaidBooking($this->resource),
            'status' => $this->status->mobileLabel(),
            'statusKey' => $this->status->value,
            'adminStatus' => $this->status->adminLabel(),
            'vehicleId' => (string) $this->vehicle_id,
            'vehicleName' => $this->vehicle?->name,
            'vehiclePlateNumber' => $this->when($isManagement || $isDriverView, fn () => $this->vehicle?->plate_number),
            'brand' => $this->vehicle?->brand,
            'model' => $this->vehicle?->model,
            'color' => $this->vehicle?->color,
            'image' => PublicStorageUrl::make($image),
            'rentalDate' => $this->rental_start_at?->copy()->setTimezone('Asia/Manila')->format('D, M j, Y - g:i A'),
            'returnDate' => $this->rental_end_at?->copy()->setTimezone('Asia/Manila')->format('D, M j, Y - g:i A'),
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
            'driverAssignedAt' => $this->assignment?->assigned_at?->toISOString(),
            'telematicsSetupStatus' => app(TelematicsCalibrationService::class)->effectiveStatus($this->telematicsSetupSession)?->value,
            'telematicsHandover' => $this->when(
                $isManagement && $telematicsSupported,
                fn () => new TelematicsHandoverResource($this->resource)
            ),
            'monitoringZones' => $this->when($hasMonitoringDetails,
                fn () => BookingGeofenceResource::collection(app(BookingGeofenceService::class)->zonesFor($this->resource))),
            'canManageMonitoringZones' => $isManagement && ($request->user()?->hasRole('admin') ?? false)
                && $telematicsSupported && in_array($this->status->value, ['pending', 'confirmed'], true) && ! $this->started_at,
            'geofenceActivity' => $this->when($hasMonitoringDetails, fn () => $this->telematicsEvents()->whereIn('event_type', ['geofence_enter', 'geofence_exit'])->orderByDesc('occurred_at')->limit(30)->get()->map(fn ($event) => [
                'id' => (string) $event->id, 'type' => $event->event_type->value, 'zoneName' => $event->metadata['zone_name'] ?? 'Monitoring zone',
                'notificationRequested' => $event->metadata['notification_requested'] ?? false, 'occurredAt' => $event->occurred_at?->toISOString(),
            ])),
            'lateReturn' => $this->when(! $isDriverView, function () use ($isManagement) {
                $details = app(BookingReturnService::class)->estimate($this->resource);
                if (! $isManagement) {
                    // Responsible charges already have their own owner-scoped resource.
                    $details['approvedAmount'] = null;
                }

                return $details;
            }),
            'attention' => app(BookingAttentionService::class)->state($this->resource),
            'returnFollowUps' => $this->when($isManagement, fn () => $this->events->where('event_type', 'return_follow_up')->sortByDesc('created_at')->take(20)->map(fn ($event) => ['note' => $event->reason, 'recordedAt' => $event->created_at->toISOString()])->values()),
            'upcomingBookings' => $this->when($isManagement && $this->relationLoaded('vehicleInspections'), fn () => app(BookingAttentionService::class)->upcomingBookings($this->resource)),
            'returnedAt' => $this->returned_at?->toISOString(),
            'completedAt' => $this->completed_at?->toISOString(),
            'returnChargesFinalizedAt' => $this->return_charges_finalized_at?->toISOString(),
            'transmission' => $this->vehicle?->transmission,
            'fuelType' => $this->vehicle?->fuel_type,
            'seats' => $this->vehicle?->seats,
            'pricePerDay' => $isDriverView ? 0 : (float) $this->price_per_day,
            'subtotal' => $isDriverView ? 0 : (float) $this->subtotal,
            'deliveryLocation' => $this->deliveryQuote ? [
                'address' => $this->deliveryQuote->destination_address,
                'placeId' => $this->deliveryQuote->destination_place_id,
                'point' => $this->deliveryQuote->point_expires_at->isFuture() ? $this->deliveryQuote->destination_point : null,
                'routeLabel' => $this->deliveryQuote->route_label,
            ] : null,
            'deliveryTollFee' => $isDriverView ? 0 : (float) $this->delivery_toll_fee,
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
            'customerPaidAmount' => $this->when(
                $isManagement && ! $isDriverView && $this->relationLoaded('payments'),
                fn () => array_key_exists('customer_paid_total', $this->resource->getAttributes())
                    ? (float) $this->customer_paid_total : (float) $this->successfulCustomerPayments()->sum('amount'),
            ),
            'remainingBalance' => $isDriverView ? 0 : max((float) $this->remaining_balance, max((float) $this->total_amount - $paidAmount, 0)),
            'balanceDueAt' => $isDriverView ? null : $this->balance_due_at?->toISOString(),
            'confirmationEmailSentAt' => $this->confirmation_email_sent_at?->toISOString(),
            'confirmationEmailStatus' => $this->confirmation_email_status,
            'paymentStatus' => $isDriverView ? 'Private' : $this->payment_status->label(),
            'paymentStatusKey' => $isDriverView ? null : $this->payment_status->value,
            'paymentMethod' => $isDriverView ? 'N/A' : ($latestPayment?->payment_method ?? 'N/A'),
            'transactionId' => $isDriverView ? 'N/A' : ($latestPayment?->transaction_id ?? 'N/A'),
            'paidAt' => $isDriverView ? 'N/A' : ($latestPayment?->paid_at?->copy()->setTimezone('Asia/Manila')->format('F j, Y - g:i A') ?? 'N/A'),
            'createdAt' => $this->created_at?->copy()->setTimezone('Asia/Manila')->format('F j, Y - g:i A'),
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
                    : (bool) ($this->outgoing_finalized ?? false),
                'telematicsSetupStatus' => $this->telematicsSetupSession?->status?->value,
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
                    : (bool) ($this->incoming_finalized ?? false),
            ],
            'sharedVehicleLocation' => $this->when(
                $this->rental_type === RentalType::OwnersDriver
                    && (int) $request->user()?->id === (int) $this->user_id
                    && $this->relationLoaded('telematicsTrips')
                    && $this->relationLoaded('telematicsSetupSession')
                    && $this->relationLoaded('returnRecord'),
                fn () => app(LocationMonitoringService::class)
                    ->sharedVehicleLocationForCustomer($this->resource, $request->user())
            ),
            'customer' => $this->whenLoaded('user', function () use ($isManagement, $isDriverView, $request) {
                if ($isManagement || $request->user()?->id === $this->user_id) {
                    return new UserResource($this->user);
                }

                if ($isDriverView) {
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
                'timestamp' => $this->created_at?->copy()->setTimezone('Asia/Manila')->format('F j, Y - g:i A') ?? '',
                'completed' => true,
            ],
            [
                'title' => 'Booking Confirmed',
                'description' => 'Your booking has been confirmed.',
                'timestamp' => $this->confirmed_at?->copy()->setTimezone('Asia/Manila')->format('F j, Y - g:i A') ?? '',
                'completed' => in_array($this->status, [BookingStatus::Confirmed, BookingStatus::Ongoing, BookingStatus::Returned, BookingStatus::Completed], true),
            ],
            [
                'title' => 'Rental Active',
                'description' => 'Your rental is currently active.',
                'timestamp' => $this->started_at?->copy()->setTimezone('Asia/Manila')->format('F j, Y - g:i A') ?? '',
                'completed' => in_array($this->status, [BookingStatus::Ongoing, BookingStatus::Returned, BookingStatus::Completed], true),
            ],
            [
                'title' => 'Vehicle Returned',
                'description' => 'The vehicle return and Incoming Inspection are complete.',
                'timestamp' => $this->returned_at?->copy()->setTimezone('Asia/Manila')->format('F j, Y - g:i A') ?? '',
                'completed' => in_array($this->status, [BookingStatus::Returned, BookingStatus::Completed], true),
            ],
            [
                'title' => 'Completed',
                'description' => 'Your rental has been completed.',
                'timestamp' => $this->completed_at?->copy()->setTimezone('Asia/Manila')->format('F j, Y - g:i A') ?? '',
                'completed' => $this->status === BookingStatus::Completed,
            ],
        ];

        if ($this->status === BookingStatus::Rejected) {
            return [
                $items[0],
                [
                    'title' => 'Booking Rejected',
                    'description' => $this->admin_notes ?: 'Your booking was rejected.',
                    'timestamp' => $this->rejected_at?->copy()->setTimezone('Asia/Manila')->format('F j, Y - g:i A') ?? '',
                    'completed' => true,
                ],
            ];
        }

        if ($this->status === BookingStatus::Cancelled) {
            $items[] = [
                'title' => 'Booking Cancelled',
                'description' => $this->admin_notes ?: 'This booking was cancelled.',
                'timestamp' => $this->cancelled_at?->copy()->setTimezone('Asia/Manila')->format('F j, Y - g:i A') ?? '',
                'completed' => true,
            ];
        }

        return $items;
    }
}
