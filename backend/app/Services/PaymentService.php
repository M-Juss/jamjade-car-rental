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
            $proofPath = $proof?->store('payment-proofs', 'public');
            $amount = (float) $data['amount'];

            $payment = Payment::create([
                'booking_id' => $booking->id,
                'user_id' => $booking->user_id,
                'payment_method' => $data['payment_method'],
                'payment_status' => PaymentStatus::Pending,
                'amount' => $amount,
                'transaction_id' => $data['transaction_id'] ?? null,
                'paid_at' => now(),
                'proof_of_payment' => $proofPath,
            ]);

            $paidAmount = $booking->payments()->sum('amount');
            $paymentStatus = $paidAmount >= (float) $booking->total_amount
                ? PaymentStatus::Paid
                : PaymentStatus::Partial;

            $booking->update([
                'payment_status' => $paymentStatus,
                'remaining_balance' => max((float) $booking->total_amount - $paidAmount, 0),
            ]);

            activity()
                ->causedBy($user)
                ->performedOn($payment)
                ->event('payment_recorded')
                ->withProperties(['booking_code' => $booking->booking_code, 'amount' => $amount])
                ->log('Payment recorded for booking.');

            return $payment->fresh('booking');
        });
    }
}
