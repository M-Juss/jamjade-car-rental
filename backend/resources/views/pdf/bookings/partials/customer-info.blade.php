<section class="section">
    <div class="section-heading"><h2 class="section-title">Customer Information</h2></div>
    <table class="info-grid info-grid-three"><tr>
        <td><span class="label">Full Name</span><span class="value">{{ $displayValue($confirmation['customer']['name']) }}</span></td>
        <td><span class="label">Email</span><span class="value">{{ $displayValue($confirmation['customer']['email']) }}</span></td>
        <td><span class="label">Phone Number</span><span class="value">{{ $displayValue($confirmation['customer']['phone']) }}</span></td>
    </tr></table>
    <table class="info-grid"><tr><td style="width:100%;padding-left:0;border-left:0;">
        <span class="label">Address</span><span class="value">{{ $displayValue($confirmation['customer']['address']) }}</span>
    </td></tr></table>
</section>
