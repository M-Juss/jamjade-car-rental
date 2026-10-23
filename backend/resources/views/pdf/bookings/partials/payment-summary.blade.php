<section class="section">
    <div class="section-heading">
        <h2 class="section-title">Price Breakdown</h2>
    </div>
    <table class="payment-table">
        <tr><td>Price per Day</td><td class="amount">{{ $formatMoney($confirmation['payment']['pricePerDay']) }}</td></tr>
        <tr><td>Number of Days</td><td class="amount">{{ $confirmation['rental']['days'] }}</td></tr>
        @foreach ($confirmation['payment']['items'] as $item)
            <tr><td>{{ $item['label'] }}</td><td class="amount">{{ $formatMoney($item['amount']) }}</td></tr>
        @endforeach
        <tr class="total-row"><td>Total Amount</td><td class="amount">{{ $formatMoney($confirmation['payment']['totalAmount']) }}</td></tr>
        @if (($confirmation['formatVersion'] ?? 1) < 2)
        <tr class="paid-row"><td>Total Paid as of Issue</td><td class="amount">{{ $formatMoney($confirmation['payment']['amountPaid']) }}</td></tr>
        <tr class="balance-row"><td>Remaining Balance as of Issue</td><td class="amount">{{ $formatMoney($confirmation['payment']['remainingBalance']) }}</td></tr>
        @endif
    </table>
</section>
