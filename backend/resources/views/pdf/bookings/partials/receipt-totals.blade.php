<section class="section">
    <div class="section-heading"><h2 class="section-title">Payment Summary</h2></div>
    <table class="payment-table">
        <tr class="total-row"><td>Amount Received in This Payment</td><td class="amount">{{ $formatMoney($confirmation['receipt']['amount'] ?? 0) }}</td></tr>
        <tr><td>Total Paid as of Issue</td><td class="amount">{{ $formatMoney($confirmation['payment']['amountPaid']) }}</td></tr>
        <tr><td>Agreed Rental Total</td><td class="amount">{{ $formatMoney($confirmation['agreedRentalTotal'] ?? $confirmation['payment']['totalAmount']) }}</td></tr>
        @foreach (($confirmation['additionalChargeItems'] ?? []) as $item)
        <tr><td>{{ $item['label'] }}</td><td class="amount">{{ $formatMoney($item['amount']) }}</td></tr>
        @endforeach
        @if (!empty($confirmation['additionalChargeItems']) || ($confirmation['agreedRentalTotal'] ?? $confirmation['payment']['totalAmount']) != $confirmation['payment']['totalAmount'])
        <tr><td>Booking Total Including Additional Charges</td><td class="amount">{{ $formatMoney($confirmation['payment']['totalAmount']) }}</td></tr>
        @endif
        <tr><td>Settlement Status as of Payment</td><td class="amount">{{ $confirmation['paymentStatusLabel'] }}</td></tr>
        <tr class="balance-row"><td>Remaining Balance as of Issue</td><td class="amount">{{ $formatMoney($confirmation['payment']['remainingBalance']) }}</td></tr>
    </table>
    <p class="acknowledgement-copy">This receipt acknowledges only the payment identified above. It does not confirm full settlement unless the remaining balance is zero.</p>
</section>
