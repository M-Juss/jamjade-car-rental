<?php

namespace App\Services;

use App\Enums\AdditionalChargeResponsibility;
use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Enums\VehicleStatus;
use App\Models\Booking;
use App\Models\CustomerDocument;
use App\Models\Payment;
use App\Models\User;
use App\Models\Vehicle;
use App\Support\CustomerAgePolicy;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BookingService
{
    public const DOWN_PAYMENT_RATE = 0.5;

    public const DELIVERY_FEE = 900;

    public const SHOP_LOCATION = 'Jamjade Rent A Car Services';

    public const JAMJADE_GARAGE = 'Jamjade Garage';

    public const OWNER_DRIVER_METRO_MANILA_DAILY_RATE = 700;

    public const OWNER_DRIVER_OUTSIDE_MANILA_DAILY_RATE = 1000;

    public const LATE_RETURN_HOURLY_RATE = 200;

    public function __construct(
        private readonly NotificationService $notificationService,
        private readonly BookingEmailService $bookingEmailService,
        private readonly VehicleAvailabilityService $availabilityService,
        private readonly VehicleOperationalStatusService $operationalStatusService,
        private readonly RentalReadinessService $readinessService,
        private readonly AdditionalChargeService $additionalChargeService,
        private readonly TelematicsSetupService $telematicsSetup
    ) {}

    public function paginateForUser(User $user, array $filters = [], int $perPage = 10): LengthAwarePaginator
    {
        return Booking::query()
            ->with([
                'vehicle.images', 'vehicle.features', 'payments', 'user.documents', 'assignedDriver',
                'assignment', 'terms', 'confirmationEmail', 'events', 'telematicsSetupSession',
            ])
            ->where('user_id', $user->id)
            ->when($filters['status'] ?? null, fn ($query, string $status) => $query->where('status', $status))
            ->latest()
            ->paginate($perPage);
    }

    public function paginateForAdmin(array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        return Booking::query()
            ->withExists([
                'vehicleInspections as outgoing_finalized' => fn ($query) => $query->where('type', 'outgoing')->where('status', 'finalized'),
                'vehicleInspections as incoming_finalized' => fn ($query) => $query->where('type', 'incoming')->where('status', 'finalized'),
            ])
            ->with([
                'vehicle.images', 'user.customerProfile', 'user.documents', 'payments', 'assignedDriver',
                'assignment', 'terms', 'confirmationEmail', 'events', 'telematicsSetupSession',
            ])
            ->when($filters['search'] ?? null, function ($query, string $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('booking_code', 'like', "%{$search}%")
                        ->orWhereHas('vehicle', fn ($query) => $query->where('name', 'like', "%{$search}%"))
                        ->orWhereHas('user', fn ($query) => $query->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%"));
                    if (ctype_digit($search)) {
                        $query->orWhere('vehicle_id', (int) $search);
                    }
                });
            })
            ->when($filters['status'] ?? null, fn ($query, string $status) => $query->where('status', $status))
            ->when($filters['payment_status'] ?? null, fn ($query, string $status) => $query->where('payment_status', $status))
            ->when($filters['group'] ?? null, fn ($query, string $group) => $group === 'history'
                ? $query->whereIn('status', BookingStatus::terminalValues())
                : $query->whereNotIn('status', BookingStatus::terminalValues()))
            ->latest()
            ->orderByDesc('id')
            ->paginate($perPage);
    }

    /** @return array<string, int> */
    public function adminStatusCounts(): array
    {
        return Booking::query()
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status')
            ->map(fn ($total) => (int) $total)
            ->all();
    }

    public function create(User $user, array $data, ?UploadedFile $paymentProof = null): Booking
    {
        return $this->createBooking($user, $data, $paymentProof, false);
    }

    public function createAwaitingPayPalPayment(User $user, array $data): Booking
    {
        return $this->createBooking($user, $data, null, true);
    }

    public function transition(Booking $booking, BookingStatus $targetStatus, User $actor, ?string $reason = null, array $extra = []): Booking
    {
        return DB::transaction(function () use ($booking, $targetStatus, $actor, $reason, $extra) {
            $booking = Booking::query()->lockForUpdate()->with('vehicle')->findOrFail($booking->id);
            $oldStatus = $booking->status;

            if (! in_array($targetStatus, $oldStatus->allowedTransitions(), true)) {
                throw ValidationException::withMessages([
                    'status' => ["Cannot transition booking from {$oldStatus->value} to {$targetStatus->value}."],
                ]);
            }

            if ($targetStatus === BookingStatus::Ongoing) {
                $this->readinessService->assertStartAllowed($booking);
            } elseif ($targetStatus === BookingStatus::Returned) {
                $this->readinessService->assertReturnAllowed($booking);
            } elseif ($targetStatus === BookingStatus::Completed) {
                $this->readinessService->assertCompleteAllowed($booking);
            }

            $changes = [
                'status' => $targetStatus,
                'admin_notes' => $extra['admin_notes'] ?? $booking->admin_notes,
            ];

            $booking->fill($changes)->save();

            if ($targetStatus === BookingStatus::Ongoing) {
                $booking->vehicle->update(['status' => VehicleStatus::Rented]);
                $this->telematicsSetup->markReleased($booking);
            }

            if (in_array($targetStatus, [BookingStatus::Returned, BookingStatus::Cancelled, BookingStatus::Rejected], true)) {
                $this->operationalStatusService->afterBookingEnded($booking->vehicle);
            }

            $booking->events()->create([
                'event_type' => 'status_changed',
                'old_status' => $oldStatus,
                'new_status' => $targetStatus,
                'actor_user_id' => $actor->id,
                'reason' => $reason,
            ]);

            activity()
                ->causedBy($actor)
                ->performedOn($booking)
                ->event('booking_status_changed')
                ->withProperties([
                    'old_status' => $oldStatus->value,
                    'new_status' => $targetStatus->value,
                    'reason' => $reason,
                ])
                ->log('Booking status changed.');

            $this->notifyStatusChange($booking, $targetStatus, $reason);

            return $booking->fresh([
                'vehicle.images', 'vehicle.features', 'payments', 'user.documents', 'assignedDriver',
                'assignment', 'terms', 'confirmationEmail', 'events', 'telematicsSetupSession',
            ]);
        });
    }

    public function cancelByCustomer(Booking $booking, User $user, ?string $reason = null): Booking
    {
        if ($booking->user_id !== $user->id) {
            abort(403, 'You can only cancel your own bookings.');
        }

        if (! in_array($booking->status, [BookingStatus::Pending, BookingStatus::Confirmed], true)) {
            throw ValidationException::withMessages([
                'status' => ['This booking can no longer be cancelled by the customer.'],
            ]);
        }

        return $this->transition($booking, BookingStatus::Cancelled, $user, $reason ?? 'Cancelled by customer.');
    }

    public function assertVehicleScheduleAvailable(
        int $vehicleId,
        mixed $start,
        mixed $end,
        ?int $ignoreBookingId = null
    ): void {
        $this->availabilityService->assertBookingIntervalAvailable($vehicleId, $start, $end, $ignoreBookingId);
    }

    public function assertCustomerAgeEligible(User $user): void
    {
        $profile = $user->customerProfile;

        if (! $profile || ! CustomerAgePolicy::isEligible($profile->birthdate)) {
            throw ValidationException::withMessages([
                'booking' => [CustomerAgePolicy::MESSAGE],
            ]);
        }
    }

    private function createBooking(
        User $user,
        array $data,
        ?UploadedFile $paymentProof,
        bool $awaitingPayPal
    ): Booking {
        return DB::transaction(function () use ($user, $data, $paymentProof, $awaitingPayPal) {
            if ($this->additionalChargeService->hasOutstanding($user, AdditionalChargeResponsibility::Customer)) {
                throw ValidationException::withMessages([
                    'booking' => ['Settle your outstanding Jamjade balance before creating a new booking.'],
                ]);
            }
            $vehicle = Vehicle::query()->lockForUpdate()->findOrFail($data['vehicle_id']);

            if ($vehicle->status !== VehicleStatus::Available) {
                throw ValidationException::withMessages([
                    'vehicle_id' => ['This vehicle is not available for booking.'],
                ]);
            }

            $rentalType = RentalType::from($data['driver_option']);
            $this->assertRentalAllowed($user, $rentalType);

            $start = CarbonImmutable::parse($data['rental_start_at']);
            $end = CarbonImmutable::parse($data['rental_end_at']);
            $this->assertVehicleScheduleAvailable($vehicle->id, $start, $end);

            $durationDays = max(1, (int) ceil($start->diffInRealHours($end) / 24));
            $pricePerDay = (float) $vehicle->price_per_day;
            $subtotal = $pricePerDay * $durationDays;
            $isOwnerDriver = $rentalType === RentalType::OwnersDriver;
            $pickupLocationType = $isOwnerDriver ? 'delivery' : 'shop';
            $pickupLocation = $isOwnerDriver ? $data['pickup_location'] : self::SHOP_LOCATION;
            $returnLocation = $isOwnerDriver ? $data['return_location'] : self::SHOP_LOCATION;
            $ownerDriverCoverage = $isOwnerDriver ? $data['owner_driver_coverage'] : null;
            $deliveryFee = $isOwnerDriver && $pickupLocation !== self::JAMJADE_GARAGE ? self::DELIVERY_FEE : 0;
            $ownerDriverFee = $isOwnerDriver
                ? $this->ownerDriverRate($ownerDriverCoverage) * $durationDays
                : 0;
            $addOnsTotal = (float) ($data['add_ons_total'] ?? 0);
            $discountTotal = (float) ($data['discount_total'] ?? 0);
            $totalAmount = max(
                $subtotal + $deliveryFee + $ownerDriverFee + $addOnsTotal - $discountTotal,
                0
            );
            $requiredDownPayment = ceil($totalAmount * self::DOWN_PAYMENT_RATE);
            $downPayment = $awaitingPayPal ? 0 : (float) $data['down_payment_amount'];

            if (! $awaitingPayPal && $downPayment < $requiredDownPayment) {
                throw ValidationException::withMessages([
                    'down_payment_amount' => ["The minimum down payment is PHP {$requiredDownPayment}."],
                ]);
            }

            $paymentStatus = $awaitingPayPal
                ? PaymentStatus::Unpaid
                : ($downPayment >= $totalAmount ? PaymentStatus::Paid : PaymentStatus::Partial);
            $proofPath = $paymentProof?->store('payment-proofs', 'public');
            $bookingStatus = $awaitingPayPal
                ? BookingStatus::Pending
                : BookingStatus::Confirmed;

            $booking = Booking::create([
                'booking_code' => $this->generateBookingCode(),
                'user_id' => $user->id,
                'vehicle_id' => $vehicle->id,
                'rental_type' => $rentalType,
                'rental_start_at' => $start,
                'rental_end_at' => $end,
                'pickup_location_type' => $pickupLocationType,
                'pickup_location' => $pickupLocation,
                'return_location' => $returnLocation,
                'owner_driver_coverage' => $ownerDriverCoverage,
                'status' => $bookingStatus,
                'payment_status' => $paymentStatus,
                'price_per_day' => $pricePerDay,
                'duration_days' => $durationDays,
                'subtotal' => $subtotal,
                'delivery_fee' => $deliveryFee,
                'owner_driver_fee' => $ownerDriverFee,
                'add_ons_total' => $addOnsTotal,
                'discount_total' => $discountTotal,
                'remaining_balance' => max($totalAmount - $downPayment, 0),
                'balance_due_at' => $paymentStatus === PaymentStatus::Partial ? $start->subDay() : null,
                'total_amount' => $totalAmount,
                'notes' => $data['notes'] ?? null,
            ]);

            $booking->terms()->create([
                'customer_signature' => $data['customer_signature'],
                'terms_version' => $data['terms_version'],
                'accepted_at' => now(),
            ]);

            if (! $awaitingPayPal) {
                Payment::create([
                    'booking_id' => $booking->id,
                    'user_id' => $user->id,
                    'provider' => str($data['payment_method'])->lower()->replace(' ', '_')->toString(),
                    'purpose' => $downPayment >= $totalAmount ? 'full_payment' : 'down_payment',
                    'status' => 'completed',
                    'amount' => $downPayment,
                    'currency' => 'PHP',
                    'provider_transaction_id' => $data['transaction_id'] ?? null,
                    'completed_at' => now(),
                    'proof_path' => $proofPath,
                ]);
            }

            $booking->events()->create([
                'event_type' => 'status_changed',
                'old_status' => null,
                'new_status' => $bookingStatus,
                'actor_user_id' => $user->id,
                'reason' => $awaitingPayPal
                    ? 'Booking created while awaiting PayPal payment.'
                    : 'Booking automatically confirmed after successful payment.',
            ]);

            activity()
                ->causedBy($user)
                ->performedOn($booking)
                ->event('booking_created')
                ->withProperties([
                    'booking_code' => $booking->booking_code,
                    'payment_provider' => $awaitingPayPal ? 'paypal' : null,
                ])
                ->log($awaitingPayPal
                    ? 'Customer started a PayPal booking checkout.'
                    : 'Customer created a booking.');

            if (! $awaitingPayPal) {
                $this->notificationService->createForBooking(
                    $booking,
                    'booking',
                    'Booking confirmed',
                    "Booking {$booking->booking_code} was automatically confirmed after payment.",
                    [
                        'priority' => 'success',
                        'action_label' => 'View Booking',
                        'action' => 'view_booking',
                    ]
                );

                if ($paymentStatus === PaymentStatus::Partial) {
                    $this->notificationService->createForBooking(
                        $booking,
                        'payment',
                        'Remaining balance scheduled',
                        sprintf(
                            'PHP %s is due by %s. If unpaid, the booking will be cancelled and the down payment is non-refundable.',
                            number_format((float) $booking->remaining_balance, 2),
                            $booking->balance_due_at->format('F j, Y - g:i A')
                        ),
                        [
                            'priority' => 'warning',
                            'action_label' => 'Pay Remaining Balance',
                            'action' => 'pay_balance',
                            'remaining_balance' => (float) $booking->remaining_balance,
                            'due_at' => $booking->balance_due_at->toISOString(),
                            'non_refundable' => true,
                        ]
                    );
                }

                $bookingId = $booking->id;

                DB::afterCommit(function () use ($bookingId) {
                    $booking = Booking::query()->find($bookingId);

                    if ($booking) {
                        $this->bookingEmailService->sendBookingConfirmation($booking);
                    }
                });
            }

            return $booking->fresh([
                'vehicle.images', 'vehicle.features', 'payments', 'user.documents', 'assignedDriver',
                'assignment', 'terms', 'confirmationEmail', 'events',
            ]);
        });
    }

    private function assertRentalAllowed(User $user, RentalType $rentalType): void
    {
        $this->assertCustomerAgeEligible($user);

        if ($rentalType !== RentalType::SelfDrive) {
            return;
        }

        $requiredDocuments = CustomerDocument::requiredSelfDriveDocumentsFor($user);
        $approvedDocumentCount = $user->documents()
            ->whereIn('document_type', $requiredDocuments)
            ->where('status', 'approved')
            ->count();

        if ($approvedDocumentCount < count($requiredDocuments)) {
            throw ValidationException::withMessages([
                'driver_option' => ['Self-drive rental requires approved customer documents.'],
            ]);
        }
    }

    private function ownerDriverRate(?string $coverage): int
    {
        return $coverage === 'outside_manila'
            ? self::OWNER_DRIVER_OUTSIDE_MANILA_DAILY_RATE
            : self::OWNER_DRIVER_METRO_MANILA_DAILY_RATE;
    }

    private function generateBookingCode(): string
    {
        do {
            $code = sprintf('BK-%05d', random_int(1, 99999));
        } while (Booking::where('booking_code', $code)->exists());

        return $code;
    }

    private function notifyStatusChange(Booking $booking, BookingStatus $status, ?string $reason): void
    {
        $notification = match ($status) {
            BookingStatus::Confirmed => [
                'title' => 'Booking confirmed',
                'message' => "Booking {$booking->booking_code} was confirmed.",
                'priority' => 'success',
            ],
            BookingStatus::Rejected => [
                'title' => 'Booking rejected',
                'message' => $reason ?: "Booking {$booking->booking_code} was rejected.",
                'priority' => 'urgent',
            ],
            BookingStatus::Ongoing => [
                'title' => 'Rental is now active',
                'message' => "Booking {$booking->booking_code} is active. Telematics is now available.",
                'priority' => 'success',
            ],
            BookingStatus::Completed => [
                'title' => 'Rental completed',
                'message' => "Booking {$booking->booking_code} was completed.",
                'priority' => 'success',
            ],
            BookingStatus::Returned => [
                'title' => 'Vehicle returned',
                'message' => "Booking {$booking->booking_code} has finished return processing. Any customer balance remains payable.",
                'priority' => 'success',
            ],
            BookingStatus::Cancelled => [
                'title' => 'Booking cancelled',
                'message' => $reason ?: "Booking {$booking->booking_code} was cancelled.",
                'priority' => 'urgent',
            ],
            default => null,
        };

        if (! $notification) {
            return;
        }

        $this->notificationService->createForBooking(
            $booking,
            'booking',
            $notification['title'],
            $notification['message'],
            [
                'priority' => $notification['priority'],
                'action_label' => 'View Booking',
                'action' => 'view_booking',
            ]
        );
    }
}
