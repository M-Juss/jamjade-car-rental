<?php

namespace App\Services;

use App\Enums\PaymentStatus;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

class PaymentService
{
    public function record(Booking $booking, User $user, array $data, ?UploadedFile $proof = null): Payment
    {
        return DB::transaction(function () use ($booking, $user, $data, $proof) {
            $wasPaid = $booking->payment_status === PaymentStatus::Paid;
            $proofPath = $proof?->store('payment-proofs', 'public');
            $amount = (float) $data['amount'];

            $payment = Payment::create([
                'booking_id' => $booking->id,
                'user_id' => $booking->user_id,
                'provider' => str($data['payment_method'])->lower()->replace(' ', '_')->toString(),
                'purpose' => 'manual_booking_payment',
                'status' => 'completed',
                'amount' => $amount,
                'currency' => 'PHP',
                'provider_transaction_id' => $data['transaction_id'] ?? null,
                'completed_at' => now(),
                'proof_path' => $proofPath,
            ]);

            $this->allocateToOutstandingCharges($booking, $payment);

            $paidAmount = $booking->successfulPayments()->sum('amount');
            $paymentStatus = $paidAmount >= (float) $booking->total_amount
                ? PaymentStatus::Paid
                : PaymentStatus::Partial;

            $booking->update([
                'payment_status' => $paymentStatus,
                'remaining_balance' => max((float) $booking->total_amount - $paidAmount, 0),
            ]);

            if ($paymentStatus === PaymentStatus::Paid && ! $wasPaid) {
                $bookingId = $booking->id;

                DB::afterCommit(function () use ($bookingId) {
                    $booking = Booking::query()->find($bookingId);

                    if ($booking) {
                        app(BookingEmailService::class)->sendBookingConfirmation($booking);
                    }
                });
            }

            activity()
                ->causedBy($user)
                ->performedOn($payment)
                ->event('payment_recorded')
                ->withProperties(['booking_code' => $booking->booking_code, 'amount' => $amount])
                ->log('Payment recorded for booking.');

            return $payment->fresh('booking');
        });
    }

    private function allocateToOutstandingCharges(Booking $booking, Payment $payment): void
    {
        $charges = $booking->additionalCharges()
            ->where('responsibility', 'customer')
            ->outstanding()
            ->orderBy('id')
            ->get();

        if ($charges->isEmpty()) {
            return;
        }

        $chargeTotal = (float) $booking->additionalCharges()
            ->where('responsibility', 'customer')
            ->sum('amount');
        $baseTotal = max((float) $booking->total_amount - $chargeTotal, 0);
        $previouslyPaid = (float) $booking->successfulPayments()
            ->whereKeyNot($payment->id)
            ->sum('amount');
        $available = max((float) $payment->amount - max($baseTotal - $previouslyPaid, 0), 0);

        foreach ($charges as $charge) {
            if ($available <= 0) {
                break;
            }

            $alreadyAllocated = (float) $charge->payments()
                ->where('payments.status', 'completed')
                ->sum('payment_charge_allocations.amount');
            $allocation = min(max((float) $charge->amount - $alreadyAllocated, 0), $available);

            if ($allocation > 0) {
                $payment->additionalCharges()->attach($charge->id, ['amount' => $allocation]);
                $available -= $allocation;
            }
        }
    }
}
