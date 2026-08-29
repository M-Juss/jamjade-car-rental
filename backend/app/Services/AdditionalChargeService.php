<?php

namespace App\Services;

use App\Enums\AdditionalChargeResponsibility;
use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\BookingAdditionalCharge;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdditionalChargeService
{
    public function __construct(private readonly NotificationService $notificationService) {}

    /** @return array<int, BookingAdditionalCharge> */
    public function create(Booking $booking, array $charges, User $actor): array
    {
        return DB::transaction(function () use ($booking, $charges, $actor) {
            $booking = Booking::query()->with(['assignedDriver', 'user'])->lockForUpdate()->findOrFail($booking->id);

            if ($booking->status !== BookingStatus::Ongoing || $booking->return_charges_finalized_at !== null) {
                throw ValidationException::withMessages([
                    'charges' => ['Additional charges can only be added after Incoming Inspection and before return charges are finalized.'],
                ]);
            }

            $hasIncoming = $booking->vehicleInspections()->where('type', 'incoming')->where('status', 'finalized')->exists();
            if (! $hasIncoming) {
                throw ValidationException::withMessages(['charges' => ['Finalize Incoming Inspection before adding charges.']]);
            }

            $created = [];
            foreach ($charges as $chargeData) {
                if ($booking->rental_type === RentalType::OwnersDriver && empty($chargeData['responsibility'])) {
                    throw ValidationException::withMessages([
                        'charges' => ['Choose whether each owner-driver charge is the Customer or Driver responsibility.'],
                    ]);
                }

                $responsibility = $booking->rental_type === RentalType::SelfDrive
                    ? AdditionalChargeResponsibility::Customer
                    : AdditionalChargeResponsibility::from($chargeData['responsibility']);
                $responsible = $responsibility === AdditionalChargeResponsibility::Customer
                    ? $booking->user
                    : $booking->assignedDriver;

                if (! $responsible) {
                    throw ValidationException::withMessages(['charges' => ['A driver must be assigned before a Driver-responsible charge can be recorded.']]);
                }

                $charge = $booking->additionalCharges()->create([
                    'type' => $chargeData['type'],
                    'description' => trim($chargeData['description']),
                    'amount' => $chargeData['amount'],
                    'responsibility' => $responsibility,
                    'responsible_user_id' => $responsible->id,
                    'payment_status' => PaymentStatus::Unpaid,
                    'created_by' => $actor->id,
                ]);
                $created[] = $charge;

                if ($responsibility === AdditionalChargeResponsibility::Customer) {
                    $booking->increment('total_amount', (float) $charge->amount);
                    $this->recomputeCustomerBalance($booking);
                }

                $this->notificationService->createForUser(
                    $responsible,
                    'payment',
                    $responsibility === AdditionalChargeResponsibility::Customer ? 'Additional Charge Added' : 'Additional Charge Assigned',
                    sprintf('%s - PHP %s for booking %s.', $charge->type->label(), number_format((float) $charge->amount, 2), $booking->booking_code),
                    [
                        'booking_id' => $booking->id,
                        'priority' => 'warning',
                        'action_label' => 'Review & Pay',
                        'action' => 'pay_outstanding',
                        'responsibility' => $responsibility->value,
                    ]
                );

                activity()->causedBy($actor)->performedOn($charge)->event('booking_additional_charge_created')
                    ->withProperties(['booking_id' => $booking->id, 'responsibility' => $responsibility->value, 'amount' => (float) $charge->amount])
                    ->log('Booking additional charge created.');
            }

            return $created;
        });
    }

    public function finalizeReview(Booking $booking, User $actor): Booking
    {
        return DB::transaction(function () use ($booking, $actor) {
            $booking = Booking::query()->lockForUpdate()->findOrFail($booking->id);
            if ($booking->status !== BookingStatus::Ongoing) {
                throw ValidationException::withMessages(['booking' => ['Return charges can only be finalized for an ongoing booking.']]);
            }
            if ($booking->return_charges_finalized_at !== null) {
                throw ValidationException::withMessages(['booking' => ['Return charges have already been finalized.']]);
            }
            if (! $booking->vehicleInspections()->where('type', 'incoming')->where('status', 'finalized')->exists()) {
                throw ValidationException::withMessages(['booking' => ['Finalize Incoming Inspection before reviewing return charges.']]);
            }

            $booking->forceFill([
                'return_charges_finalized_at' => now(),
                'return_charges_finalized_by' => $actor->id,
            ])->save();
            activity()->causedBy($actor)->performedOn($booking)->event('booking_return_charges_finalized')->log('Booking return charges finalized.');

            return $booking->fresh();
        });
    }

    public function recomputeCustomerBalance(Booking $booking): void
    {
        $paid = (float) $booking->payments()->sum('amount');
        $remaining = max((float) $booking->total_amount - $paid, 0);
        $booking->forceFill([
            'remaining_balance' => $remaining,
            'payment_status' => $remaining <= 0 ? PaymentStatus::Paid : ($paid > 0 ? PaymentStatus::Partial : PaymentStatus::Unpaid),
        ])->save();
    }

    public function hasOutstanding(User $user, ?AdditionalChargeResponsibility $responsibility = null): bool
    {
        return BookingAdditionalCharge::query()
            ->where('responsible_user_id', $user->id)
            ->when($responsibility, fn ($query, $value) => $query->where('responsibility', $value->value))
            ->whereIn('payment_status', [PaymentStatus::Unpaid->value, PaymentStatus::Pending->value, PaymentStatus::Failed->value])
            ->exists();
    }
}
