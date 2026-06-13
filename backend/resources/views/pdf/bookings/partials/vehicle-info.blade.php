<section class="section">
    <div class="section-heading">
        <h2 class="section-title">Vehicle Information</h2>
    </div>
    <table class="info-grid">
        <tr>
            <td>
                <span class="label">Vehicle Name</span>
                <span class="value">{{ $displayValue($confirmation['vehicle']['name']) }}</span>
            </td>
            <td>
                <span class="label">Brand / Model</span>
                <span class="value">
                    {{ $displayValue(trim(($confirmation['vehicle']['brand'] ?? '').' '.($confirmation['vehicle']['model'] ?? ''))) }}
                </span>
            </td>
        </tr>
        <tr>
            <td>
                <span class="label">Transmission</span>
                <span class="value">{{ $displayValue($confirmation['vehicle']['transmission']) }}</span>
            </td>
            <td>
                <span class="label">Fuel Type</span>
                <span class="value">{{ $displayValue($confirmation['vehicle']['fuelType']) }}</span>
            </td>
        </tr>
        <tr>
            <td>
                <span class="label">Seating Capacity</span>
                <span class="value">
                    {{ filled($confirmation['vehicle']['seats']) ? $confirmation['vehicle']['seats'].' seats' : 'Not provided' }}
                </span>
            </td>
            <td>
                <span class="label">Color</span>
                <span class="value">{{ $displayValue($confirmation['vehicle']['color']) }}</span>
            </td>
        </tr>
    </table>
</section>
