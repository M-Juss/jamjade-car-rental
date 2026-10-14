<section class="section keep-together">
    <div class="section-heading">
        <h2 class="section-title">Payment Summary</h2>
    </div>
    <table class="payment-table">
        <tr>
            <td>Price per Day</td>
            <td class="amount">{{ $formatMoney($booking->price_per_day) }}</td>
        </tr>
        <tr>
            <td>Number of Days</td>
            <td class="amount">{{ (int) $booking->duration_days }}</td>
        </tr>
        <tr>
            <td>Subtotal</td>
            <td class="amount">{{ $formatMoney($booking->subtotal) }}</td>
        </tr>
        <tr>
            <td>Add-ons Total</td>
            <td class="amount">{{ $formatMoney($booking->add_ons_total) }}</td>
        </tr>
        @if ((float) $booking->delivery_fee > 0)
            <tr>
                <td>Delivery Fee</td>
                <td class="amount">{{ $formatMoney($booking->delivery_fee) }}</td>
            </tr>
        @endif
        @if ((float) $booking->delivery_toll_fee > 0)
            <tr><td>Delivery Toll</td><td class="amount">{{ $formatMoney($booking->delivery_toll_fee) }}</td></tr>
        @endif
        @if ((float) $booking->owner_driver_fee > 0)
            <tr>
                <td>Owner's Driver Fee</td>
                <td class="amount">{{ $formatMoney($booking->owner_driver_fee) }}</td>
            </tr>
        @endif
        @if ((float) $booking->outside_manila_fee > 0)
            <tr>
                <td>Outside Manila Fee</td>
                <td class="amount">{{ $formatMoney($booking->outside_manila_fee) }}</td>
            </tr>
        @endif
        @if ((float) $booking->toll_fee > 0)
            <tr>
                <td>Toll Fee</td>
                <td class="amount">{{ $formatMoney($booking->toll_fee) }}</td>
            </tr>
        @endif
        @if ((float) $booking->late_fee > 0)
            <tr>
                <td>Late Fee</td>
                <td class="amount">{{ $formatMoney($booking->late_fee) }}</td>
            </tr>
        @endif
        @if ((float) $booking->discount_total > 0)
            <tr>
                <td>Discount</td>
                <td class="amount">-{{ $formatMoney($booking->discount_total) }}</td>
            </tr>
        @endif
        <tr class="total-row">
            <td>Total Amount</td>
            <td class="amount">{{ $formatMoney($confirmation['payment']['totalAmount']) }}</td>
        </tr>
        <tr class="paid-row">
            <td>Amount Paid</td>
            <td class="amount">{{ $formatMoney($confirmation['payment']['amountPaid']) }}</td>
        </tr>
        <tr class="balance-row">
            <td>Remaining Balance</td>
            <td class="amount">{{ $formatMoney($confirmation['payment']['remainingBalance']) }}</td>
        </tr>
    </table>

    <table class="info-grid info-grid-four payment-meta">
        <tr>
            <td>
                <span class="label">Payment Status</span>
                <span class="status-badge {{ $confirmation['paymentStatusClass'] }}">
                    {{ $confirmation['paymentStatusLabel'] }}
                </span>
            </td>
            <td>
                <span class="label">Payment Method</span>
                <span class="value">{{ $displayValue($confirmation['payment']['method']) }}</span>
            </td>
            <td>
                <span class="label">Transaction ID</span>
                <span class="value">{{ $displayValue($confirmation['payment']['transactionId']) }}</span>
            </td>
            <td>
                <span class="label">Paid At</span>
                <span class="value">{{ $formatDate($confirmation['payment']['paidAt']) }}</span>
            </td>
        </tr>
    </table>
</section>
