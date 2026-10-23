<section class="section">
    <div class="section-heading">
        <h2 class="section-title">Customer Information</h2>
    </div>
    <table class="info-grid">
        <tr>
            <td>
                <span class="label">Full Name</span>
                <span class="value">{{ $displayValue($confirmation['customer']['name']) }}</span>
            </td>
            <td>
                <span class="label">Email</span>
                <span class="value">{{ $displayValue($confirmation['customer']['email']) }}</span>
            </td>
        </tr>
        <tr>
            <td>
                <span class="label">Phone Number</span>
                <span class="value">{{ $displayValue($confirmation['customer']['phone']) }}</span>
            </td>
            @if (($confirmation['formatVersion'] ?? 1) >= 3)
            <td><span class="label">Address</span><span class="value">{{ $displayValue($confirmation['customer']['address']) }}</span></td>
            @else
            <td></td>
            @endif
        </tr>
        @if (($confirmation['formatVersion'] ?? 1) < 3)
        <tr>
            <td colspan="2" style="width: 100%; border-left: 0; padding-left: 0;">
                <span class="label">Address</span>
                <span class="value">{{ $displayValue($confirmation['customer']['address']) }}</span>
            </td>
        </tr>
        @endif
    </table>
</section>
