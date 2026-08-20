<section class="section">
    <div class="section-heading">
        <h2 class="section-title">Rental Details</h2>
    </div>
    <table class="info-grid">
        <tr>
            <td>
                <span class="label">Pickup Date and Time</span>
                <span class="value">{{ $formatDate($booking->rental_start_at) }}</span>
            </td>
            <td>
                <span class="label">Return Date and Time</span>
                <span class="value">{{ $formatDate($booking->rental_end_at) }}</span>
            </td>
        </tr>
        <tr>
            <td>
                <span class="label">Rental Duration</span>
                <span class="value">
                    {{ $booking->duration_days ?? 0 }} {{ (int) $booking->duration_days === 1 ? 'day' : 'days' }}
                </span>
            </td>
            <td>
                <span class="label">Pickup Option</span>
                <span class="value">
                    {{ $booking->pickup_location_type === 'delivery' ? 'Delivery / Preferred Location' : 'Shop Pickup' }}
                </span>
            </td>
        </tr>
        <tr>
            <td>
                <span class="label">Pickup Location</span>
                <span class="value">{{ $displayValue($booking->pickup_location) }}</span>
            </td>
            <td>
                <span class="label">{{ $booking->pickup_location_type === 'delivery' ? 'End Trip Location' : 'Return Location' }}</span>
                <span class="value">{{ $displayValue($booking->return_location) }}</span>
            </td>
        </tr>
        @if ($booking->pickup_location_type === 'delivery')
            <tr class="info-grid-four">
                <td>
                    <span class="label">Driver Option</span>
                    <span class="value">{{ $booking->rental_type?->label() ?? $displayValue($booking->driver_option) }}</span>
                </td>
                <td>
                    <span class="label">Driver Name</span>
                    <span class="value">{{ $confirmation['driver']['name'] ?? 'To be assigned' }}</span>
                </td>
                <td>
                    <span class="label">Contact Number</span>
                    <span class="value">{{ $confirmation['driver']['phone'] ?? 'To be assigned' }}</span>
                </td>
                <td></td>
            </tr>
        @endif
    </table>
</section>
