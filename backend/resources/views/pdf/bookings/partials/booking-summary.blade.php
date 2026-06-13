<section class="section">
    <div class="section-heading">
        <h2 class="section-title">Booking Summary</h2>
    </div>
    <table class="info-grid">
        <tr>
            <td>
                <span class="label">Booking ID / Reference</span>
                <span class="value">{{ $confirmation['bookingReference'] }}</span>
            </td>
            <td>
                <span class="label">Booking Status</span>
                <span class="status-badge {{ $confirmation['bookingStatusClass'] }}">
                    {{ $confirmation['bookingStatusLabel'] }}
                </span>
            </td>
        </tr>
        <tr>
            <td>
                <span class="label">Payment Status</span>
                <span class="status-badge {{ $confirmation['paymentStatusClass'] }}">
                    {{ $confirmation['paymentStatusLabel'] }}
                </span>
            </td>
            <td>
                <span class="label">Date Created</span>
                <span class="value">{{ $formatDate($booking->created_at) }}</span>
            </td>
        </tr>
        <tr>
            <td>
                <span class="label">Date Issued</span>
                <span class="value">{{ $formatDate($confirmation['issuedAt']) }}</span>
            </td>
            <td>
                <span class="label">Terms Accepted</span>
                <span class="value">{{ $formatDate($booking->terms_accepted_at) }}</span>
            </td>
        </tr>
    </table>
</section>
