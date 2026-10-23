<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\BookingPaymentDocument;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class CustomerReceiptService
{
    public function query(User $customer): Builder
    {
        return BookingPaymentDocument::query()
            ->whereHas('booking', fn (Builder $query) => $query->where('user_id', $customer->id))
            ->whereHas('payment', fn (Builder $query) => $this->customerPayments($query, $customer)
                ->whereColumn('payments.booking_id', 'booking_payment_documents.booking_id'));
    }

    public function find(User $customer, int $id): BookingPaymentDocument
    {
        return $this->query($customer)->findOrFail($id);
    }

    public function booking(User $customer, string $reference): Booking
    {
        return Booking::query()->where('user_id', $customer->id)
            ->where(fn (Builder $query) => $query->where('booking_code', $reference)->orWhere('id', $reference))
            ->firstOrFail();
    }

    public function paymentForOrder(User $customer, string $orderId): Payment
    {
        return $this->customerPayments(Payment::query(), $customer)
            ->where('provider', 'paypal')->where('provider_order_id', $orderId)
            ->whereHas('booking', fn (Builder $query) => $query->where('user_id', $customer->id))
            ->firstOrFail();
    }

    private function customerPayments(Builder $query, User $customer): Builder
    {
        // An issued receipt remains historical evidence after a recorded refund.
        return $query->where('user_id', $customer->id)->where('currency', 'PHP')->where('amount', '>', 0)
            ->whereIn('status', ['completed', 'refunded'])
            ->where(fn (Builder $query) => $query->whereNull('purpose')->orWhere('purpose', '!=', 'driver_outstanding'));
    }
}
