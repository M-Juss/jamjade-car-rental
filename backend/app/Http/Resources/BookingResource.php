<?php

namespace App\Http\Resources;

use App\Enums\BookingStatus;
use App\Models\CustomerDocument;
use App\Support\PublicStorageUrl;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BookingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
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
            'transmission' => $this->vehicle?->transmission,
            'fuelType' => $this->vehicle?->fuel_type,
            'seats' => $this->vehicle?->seats,
            'pricePerDay' => (float) $this->price_per_day,
            'subtotal' => (float) $this->subtotal,
            'deliveryFee' => (float) $this->delivery_fee,
            'outsideManilaFee' => (float) $this->outside_manila_fee,
            'ownerDriverFee' => (float) $this->owner_driver_fee,
            'tollFee' => (float) $this->toll_fee,
            'lateFee' => (float) $this->late_fee,
            'optionalServices' => (float) $this->add_ons_total,
            'addOns' => (float) $this->add_ons_total,
            'discount' => (float) $this->discount_total,
            'penaltyTotal' => (float) $this->penalty_total,
            'downPayment' => (float) $this->down_payment_amount,
            'totalAmount' => (float) $this->total_amount,
            'remainingBalance' => max((float) $this->remaining_balance, max((float) $this->total_amount - $paidAmount, 0)),
            'balanceDueAt' => $this->balance_due_at?->toISOString(),
            'confirmationEmailSentAt' => $this->confirmation_email_sent_at?->toISOString(),
            'confirmationEmailStatus' => $this->confirmation_email_status,
            'paymentStatus' => $this->payment_status->label(),
            'paymentStatusKey' => $this->payment_status->value,
            'paymentMethod' => $latestPayment?->payment_method ?? 'N/A',
            'transactionId' => $latestPayment?->transaction_id ?? 'N/A',
            'paidAt' => $latestPayment?->paid_at?->format('F j, Y - g:i A') ?? 'N/A',
            'createdAt' => $this->created_at?->format('F j, Y - g:i A'),
            'notes' => $this->notes,
            'adminNotes' => $this->admin_notes,
            'documents' => $this->documentSummary(),
            'timeline' => $this->timeline(),
            'payments' => PaymentResource::collection($payments),
            'customer' => new UserResource($this->whenLoaded('user')),
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
                'title' => 'Booking Approved',
                'description' => 'Your booking has been approved.',
                'timestamp' => $this->confirmed_at?->format('F j, Y - g:i A') ?? '',
                'completed' => in_array($this->status, [BookingStatus::Confirmed, BookingStatus::Ongoing, BookingStatus::Completed], true),
            ],
            [
                'title' => 'Rental Active',
                'description' => 'Your rental is currently active.',
                'timestamp' => $this->started_at?->format('F j, Y - g:i A') ?? '',
                'completed' => in_array($this->status, [BookingStatus::Ongoing, BookingStatus::Completed], true),
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
