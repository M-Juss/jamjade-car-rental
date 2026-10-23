<section class="section">
    <div class="section-heading">
        <h2 class="section-title">Booking Summary</h2>
    </div>
    <table class="info-grid">
        @if (($confirmation['formatVersion'] ?? 1) >= 3)
        <tr>
            <td><span class="label">Receipt Reference</span><span class="value">{{ $confirmation['receipt']['reference'] ?? 'Not provided' }}</span></td>
            <td><span class="label">Booking Status</span><span class="value">{{ $confirmation['bookingStatusLabel'] }}</span></td>
        </tr>
        <tr>
            <td><span class="label">Payment Date</span><span class="value">{{ $formatDate($confirmation['receipt']['paidAt'] ?? null) }}</span></td>
            <td><span class="label">Payment Method</span><span class="value">{{ $displayValue($confirmation['receipt']['method'] ?? null) }}</span></td>
        </tr>
        <tr>
            <td><span class="label">Transaction Reference</span><span class="value">{{ $displayValue($confirmation['receipt']['transactionId'] ?? null) }}</span></td>
            <td><span class="label">Payment Purpose</span><span class="value">{{ $displayValue($confirmation['receipt']['purpose'] ?? null) }}</span></td>
        </tr>
        @else
        <tr>
            <td>
                <span class="label">Invoice Reference</span>
                <span class="value">{{ $displayValue($confirmation['invoiceReference']) }}</span>
            </td>
            <td>
                <span class="label">Date Created</span>
                <span class="value">{{ $formatDate($confirmation['createdAt']) }}</span>
            </td>
        </tr>
        @if (($confirmation['formatVersion'] ?? 1) < 2)
        <tr>
            <td><span class="label">Booking Status</span><span class="value">{{ $confirmation['bookingStatusLabel'] }}</span></td>
            <td><span class="label">Payment Status</span><span class="value">{{ $confirmation['paymentStatusLabel'] }}</span></td>
        </tr>
        @endif
        <tr>
            <td>
                <span class="label">Date Issued</span>
                <span class="value">{{ $formatDate($confirmation['issuedAt']) }}</span>
            </td>
            <td>
                <span class="label">Terms Accepted</span>
                <span class="value">{{ $formatDate($confirmation['termsAcceptedAt']) }}</span>
            </td>
        </tr>
        @endif
    </table>
</section>
