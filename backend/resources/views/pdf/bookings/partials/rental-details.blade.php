<section class="section">
    <div class="section-heading">
        <h2 class="section-title">Rental Details</h2>
    </div>
    <table class="info-grid">
        <tr>
            <td>
                <span class="label">Pickup Date and Time</span>
                <span class="value">{{ $formatDate($confirmation['rental']['startAt']) }}</span>
            </td>
            <td>
                <span class="label">Return Date and Time</span>
                <span class="value">{{ $formatDate($confirmation['rental']['endAt']) }}</span>
            </td>
        </tr>
        <tr>
            <td>
                <span class="label">Rental Duration</span>
                <span class="value">
                    {{ $confirmation['rental']['days'] ?? 0 }} {{ (int) $confirmation['rental']['days'] === 1 ? 'day' : 'days' }}
                </span>
            </td>
            <td>
                <span class="label">Pickup Option</span>
                <span class="value">
                    {{ $confirmation['rental']['pickupType'] === 'delivery' ? 'Delivery / Preferred Location' : 'Shop Pickup' }}
                </span>
            </td>
        </tr>
        @if ($confirmation['rental']['pickupLocation'] === $confirmation['rental']['returnLocation'])
        <tr><td colspan="2" style="width:100%;padding-left:0;border-left:0;">
            <span class="label">{{ $confirmation['rental']['pickupType'] === 'delivery' ? 'Pickup / End Trip Location' : 'Pickup / Return Location' }}</span>
            <span class="value">{{ $displayValue($confirmation['rental']['pickupLocation']) }}</span>
        </td></tr>
        @else
        <tr>
            <td>
                <span class="label">Pickup Location</span>
                <span class="value">{{ $displayValue($confirmation['rental']['pickupLocation']) }}</span>
            </td>
            <td>
                <span class="label">{{ $confirmation['rental']['pickupType'] === 'delivery' ? 'End Trip Location' : 'Return Location' }}</span>
                <span class="value">{{ $displayValue($confirmation['rental']['returnLocation']) }}</span>
            </td>
        </tr>
        @endif
    </table>
    @if (($confirmation['formatVersion'] ?? 1) >= 2)
        <table class="info-grid"><tr>
            <td><span class="label">{{ $confirmation['rental']['pickupType'] === 'delivery' ? 'Driver Option' : 'Rental Type' }}</span><span class="value">{{ $confirmation['rental']['driverOption'] }}</span></td>
            @if (($confirmation['rental']['coverage'] ?? null))
            <td><span class="label">Trip Coverage</span><span class="value">{{ $confirmation['rental']['coverage'] === 'outside_manila' ? 'Outside Manila' : 'Within Metro Manila' }}</span></td>
            @endif
        </tr></table>
    @endif
    @if ($confirmation['rental']['driverOption'] === "Owner's Driver" || !empty($confirmation['driver']))
        <table class="info-grid info-grid-three">
            <tr>
                <td style="width:37%;"><span class="label">Driver Name</span><span class="value">{{ $confirmation['driver']['name'] ?? 'To be assigned' }}</span></td>
                <td style="width:43%;"><span class="label">Email</span><span class="value">{{ $confirmation['driver']['email'] ?? 'Not provided' }}</span></td>
                <td style="width:20%;"><span class="label">Contact Number</span><span class="value">{{ $confirmation['driver']['phone'] ?? 'To be assigned' }}</span></td>
            </tr>
        </table>
    @endif
</section>
