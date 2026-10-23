<?php

namespace App\Services;

use App\Enums\AdditionalChargeResponsibility;
use App\Enums\AdditionalChargeType;
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
    public function create(Booking $booking, array $charges, User $actor, bool $lateReturnReview = false): array
    {
        return DB::transaction(function () use ($booking, $charges, $actor, $lateReturnReview) {
            $booking = Booking::query()->with(['assignedDriver', 'assignment', 'user'])->lockForUpdate()->findOrFail($booking->id);

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
                if ($chargeData['type'] === 'late_return' && (! $lateReturnReview || $booking->additionalCharges()->where('type', 'late_return')->exists())) {
                    throw ValidationException::withMessages(['charges' => ['Use the dedicated late return review. Only one late return charge is allowed.']]);
                }
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

            if (! $booking->returnRecord?->vehicle_received_at) {
                throw ValidationException::withMessages(['booking' => ['Record physical receipt before finalizing return charges.']]);
            }
            if (app(BookingReturnService::class)->estimate($booking)['billableHours'] > 0 && ! $booking->returnRecord?->late_charge_reviewed_at) {
                throw ValidationException::withMessages(['booking' => ['Review the late return charge before finalizing return charges.']]);
            }

            $booking->events()->create([
                'event_type' => 'return_charges_finalized',
                'actor_user_id' => $actor->id,
            ]);
            activity()->causedBy($actor)->performedOn($booking)->event('booking_return_charges_finalized')->log('Booking return charges finalized.');

            return $booking->fresh();
        });
    }

    public function update(Booking $booking, int $chargeId, array $data, User $actor): BookingAdditionalCharge
    {
        return DB::transaction(function () use ($booking, $chargeId, $data, $actor) {
            $booking = Booking::query()->with(['user', 'assignedDriver'])->lockForUpdate()->findOrFail($booking->id);
            $charge = $this->editableCharge($booking, $chargeId);
            if ($data['type'] === AdditionalChargeType::LateReturn->value) {
                throw ValidationException::withMessages(['charges.0.type' => ['Use the dedicated late return review.']]);
            }
            if ($booking->rental_type === RentalType::OwnersDriver && empty($data['responsibility'])) {
                throw ValidationException::withMessages(['charges.0.responsibility' => ['Choose who is responsible for this charge.']]);
            }
            $responsibility = $booking->rental_type === RentalType::SelfDrive
                ? AdditionalChargeResponsibility::Customer : AdditionalChargeResponsibility::from($data['responsibility']);
            $responsible = $responsibility === AdditionalChargeResponsibility::Customer ? $booking->user : $booking->assignedDriver;
            if (! $responsible) {
                throw ValidationException::withMessages(['charges.0.responsibility' => ['Assign a Driver before assigning this charge.']]);
            }
            $previousUser = $charge->responsibleUser;
            $previousAmount = (float) $charge->amount;
            $oldCustomerAmount = $charge->responsibility === AdditionalChargeResponsibility::Customer ? $previousAmount : 0;
            $charge->update([
                'type' => $data['type'], 'description' => trim($data['description']), 'amount' => $data['amount'],
                'responsibility' => $responsibility, 'responsible_user_id' => $responsible->id,
            ]);
            $newCustomerAmount = $responsibility === AdditionalChargeResponsibility::Customer ? (float) $charge->amount : 0;
            $booking->increment('total_amount', $newCustomerAmount - $oldCustomerAmount);
            $this->recomputeCustomerBalance($booking);
            if ($previousUser && $previousUser->id !== $responsible->id) {
                $this->notifyChargeChange($booking, $previousUser, 'Return Charge Reassigned', 'A return charge is no longer assigned to you.');
            }
            $this->notifyChargeChange($booking, $responsible, 'Return Charge Updated', $charge->type->label().' charge updated to PHP '.number_format((float) $charge->amount, 2).'.');
            activity()->causedBy($actor)->performedOn($charge)->event('booking_additional_charge_updated')
                ->withProperties(['booking_id' => $booking->id, 'previous_amount' => $previousAmount, 'amount' => (float) $charge->amount,
                    'responsibility' => $responsibility->value])->log('Booking additional charge updated.');

            return $charge->fresh('responsibleUser');
        });
    }

    public function delete(Booking $booking, int $chargeId, User $actor): void
    {
        DB::transaction(function () use ($booking, $chargeId, $actor) {
            $booking = Booking::query()->lockForUpdate()->findOrFail($booking->id);
            $charge = $this->editableCharge($booking, $chargeId);
            $responsible = $charge->responsibleUser;
            $amount = (float) $charge->amount;
            $responsibility = $charge->responsibility;
            $charge->delete();
            if ($responsibility === AdditionalChargeResponsibility::Customer) {
                $booking->decrement('total_amount', $amount);
                $this->recomputeCustomerBalance($booking);
            }
            if ($responsible) {
                $this->notifyChargeChange($booking, $responsible, 'Return Charge Removed', 'A PHP '.number_format($amount, 2).' return charge was removed.');
            }
            activity()->causedBy($actor)->performedOn($booking)->event('booking_additional_charge_deleted')
                ->withProperties(['charge_id' => $chargeId, 'amount' => $amount, 'responsibility' => $responsibility->value])
                ->log('Booking additional charge deleted.');
        });
    }

    private function editableCharge(Booking $booking, int $chargeId): BookingAdditionalCharge
    {
        $charge = $booking->additionalCharges()->lockForUpdate()->findOrFail($chargeId);
        if ($booking->status !== BookingStatus::Ongoing || $booking->return_charges_finalized_at
            || ! $booking->vehicleInspections()->where('type', 'incoming')->where('status', 'finalized')->exists()) {
            throw ValidationException::withMessages(['charges' => ['Charges can only be changed during the open return-charge review.']]);
        }
        if ($charge->type === AdditionalChargeType::LateReturn) {
            throw ValidationException::withMessages(['charges' => ['The reviewed late return charge cannot be changed.']]);
        }
        if ($charge->payments()->exists() || $booking->paypalCheckouts()->whereIn('purpose', ['remaining_balance', 'driver_outstanding'])
            ->whereNotIn('status', ['completed', 'failed'])->exists()) {
            throw ValidationException::withMessages(['charges' => ['This charge cannot be changed because a payment or checkout is recorded.']]);
        }

        return $charge;
    }

    private function notifyChargeChange(Booking $booking, User $user, string $title, string $message): void
    {
        $this->notificationService->createForUser($user, 'payment', $title, $message, [
            'booking_id' => $booking->id, 'action' => 'view_booking', 'action_label' => 'View Booking',
        ]);
    }

    public function recomputeCustomerBalance(Booking $booking): void
    {
        $paid = (float) $booking->successfulPayments()->sum('amount');
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
            ->outstanding()
            ->exists();
    }
}
