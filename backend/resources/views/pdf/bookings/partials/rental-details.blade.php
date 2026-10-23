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
    </table>
    @if (($confirmation['formatVersion'] ?? 1) >= 2 && (($confirmation['formatVersion'] ?? 1) < 3 || $confirmation['rental']['pickupType'] !== 'delivery'))
        <table class="info-grid"><tr>
            <td><span class="label">Rental Type</span><span class="value">{{ $confirmation['rental']['driverOption'] }}</span></td>
            @if (($confirmation['rental']['coverage'] ?? null))
            <td><span class="label">Trip Coverage</span><span class="value">{{ $confirmation['rental']['coverage'] === 'outside_manila' ? 'Outside Manila' : 'Within Metro Manila' }}</span></td>
            @endif
        </tr></table>
    @endif
    @if ($confirmation['rental']['pickupType'] === 'delivery')
        <table class="info-grid info-grid-three">
            <tr>
                <td>
                    <span class="label">Driver Option</span>
                    <span class="value">{{ $displayValue($confirmation['rental']['driverOption']) }}</span>
                    @if (($confirmation['formatVersion'] ?? 1) >= 3 && ($confirmation['rental']['coverage'] ?? null))
                    <br><span class="value">{{ $confirmation['rental']['coverage'] === 'outside_manila' ? 'Outside Manila' : 'Within Metro Manila' }}</span>
                    @endif
                </td>
                <td>
                    <span class="label">Driver Name</span>
                    <span class="value">{{ $confirmation['driver']['name'] ?? 'To be assigned' }}</span>
                </td>
                <td>
                    <span class="label">Contact Number</span>
                    <span class="value">{{ $confirmation['driver']['phone'] ?? 'To be assigned' }}</span>
                </td>
            </tr>
        </table>
    @endif
</section>
