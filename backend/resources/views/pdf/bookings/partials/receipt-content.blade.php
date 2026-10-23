@include('pdf.bookings.partials.header', ['documentTitle' => 'Payment Receipt'])

<section class="section">
    <div class="section-heading"><h2 class="section-title">Payment Received</h2></div>
    <table class="info-grid">
        <tr>
            <td><span class="label">Receipt Reference</span><span class="value">{{ $confirmation['receipt']['reference'] }}</span></td>
            <td><span class="label">{{ ($confirmation['formatVersion'] ?? 1) >= 3 ? 'Booking Reference' : 'Invoice Reference' }}</span><span class="value">{{ ($confirmation['formatVersion'] ?? 1) >= 3 ? $confirmation['bookingReference'] : $confirmation['invoiceReference'] }}</span></td>
        </tr>
        <tr>
            <td><span class="label">Customer</span><span class="value">{{ $confirmation['customer']['name'] }}</span></td>
            <td><span class="label">Email</span><span class="value">{{ $confirmation['customer']['email'] }}</span></td>
        </tr>
        <tr>
            <td><span class="label">Payment Date</span><span class="value">{{ $formatDate($confirmation['receipt']['paidAt']) }}</span></td>
            <td><span class="label">Payment Method</span><span class="value">{{ $displayValue($confirmation['receipt']['method']) }}</span></td>
        </tr>
        <tr>
            <td><span class="label">Transaction Reference</span><span class="value">{{ $displayValue($confirmation['receipt']['transactionId']) }}</span></td>
            <td><span class="label">Payment Purpose</span><span class="value">{{ $confirmation['receipt']['purpose'] }}</span></td>
        </tr>
    </table>
</section>

@if (($confirmation['formatVersion'] ?? 1) >= 2)
<section class="section">
    <div class="section-heading"><h2 class="section-title">Rental Purchased</h2></div>
    <table class="info-grid">
        <tr><td><span class="label">Vehicle</span><span class="value">{{ $displayValue(trim(($confirmation['vehicle']['brand'] ?? '').' '.($confirmation['vehicle']['name'] ?? '').' '.($confirmation['vehicle']['model'] ?? ''))) }}</span></td>
            <td><span class="label">Rental Type</span><span class="value">{{ $confirmation['rental']['driverOption'] }}</span></td></tr>
        <tr><td><span class="label">Rental Start</span><span class="value">{{ $formatDate($confirmation['rental']['startAt']) }}</span></td>
            <td><span class="label">Rental End</span><span class="value">{{ $formatDate($confirmation['rental']['endAt']) }}</span></td></tr>
    </table>
</section>
@endif
@if (($confirmation['formatVersion'] ?? 1) >= 3)
@include('pdf.bookings.partials.receipt-totals')
@else
<section class="section">
    <div class="section-heading"><h2 class="section-title">Payment Summary</h2></div>
    <table class="payment-table">
        <tr class="total-row"><td>Amount Received in This Payment</td><td class="amount">{{ $formatMoney($confirmation['receipt']['amount']) }}</td></tr>
        <tr><td>Total Paid as of Issue</td><td class="amount">{{ $formatMoney($confirmation['payment']['amountPaid']) }}</td></tr>
        @if (($confirmation['formatVersion'] ?? 1) >= 2)
        <tr><td>Agreed Invoice Total</td><td class="amount">{{ $formatMoney($confirmation['invoiceSnapshot']['payment']['totalAmount']) }}</td></tr>
        @foreach (($confirmation['additionalChargeItems'] ?? []) as $item)
        <tr><td>{{ $item['label'] }}</td><td class="amount">{{ $formatMoney($item['amount']) }}</td></tr>
        @endforeach
        <tr><td>Settlement Status as of Payment</td><td class="amount">{{ $confirmation['paymentStatusLabel'] }}</td></tr>
        @endif
        <tr><td>{{ ($confirmation['formatVersion'] ?? 1) >= 2 ? 'Booking Total Including Additional Charges' : 'Invoice Total as of Issue' }}</td><td class="amount">{{ $formatMoney($confirmation['payment']['totalAmount']) }}</td></tr>
        <tr class="balance-row"><td>Remaining Balance as of Issue</td><td class="amount">{{ $formatMoney($confirmation['payment']['remainingBalance']) }}</td></tr>
    </table>
    <p class="acknowledgement-copy">This receipt acknowledges only the payment identified above. It does not confirm full settlement unless the remaining balance is zero.</p>
</section>
@endif

<table class="page-footer"><tr><td>Jamjade Car Rental · Payment receipt</td><td>{{ $confirmation['receipt']['reference'] }}</td></tr></table>
