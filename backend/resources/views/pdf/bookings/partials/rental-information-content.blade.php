<div class="page">
    @include('pdf.bookings.partials.header', ['documentTitle' => 'Rental Information'])
    @include('pdf.bookings.partials.booking-summary')
    @include('pdf.bookings.partials.customer-info')
    @include('pdf.bookings.partials.vehicle-info')
    @include('pdf.bookings.partials.rental-details')

    <section class="section">
        <div class="section-heading"><h2 class="section-title">Agreed Rental Pricing</h2></div>
        <table class="payment-table">
            <tr><td>Price per Day</td><td class="amount">{{ $formatMoney($confirmation['rentalSnapshot']['payment']['pricePerDay'] ?? $confirmation['payment']['pricePerDay']) }}</td></tr>
            @foreach (($confirmation['rentalSnapshot']['payment']['items'] ?? $confirmation['payment']['items']) as $item)
            <tr><td>{{ $item['label'] }}</td><td class="amount">{{ $formatMoney($item['amount']) }}</td></tr>
            @endforeach
        </table>
    </section>
    @include('pdf.bookings.partials.receipt-totals')
    <table class="page-footer"><tr><td>Date issued: {{ $formatDate($confirmation['issuedAt'], 'F j, Y') }}</td><td>{{ $confirmation['receipt']['reference'] ?? '' }}</td></tr></table>
</div>

<div class="page page-break">
    @include('pdf.bookings.partials.header', ['documentTitle' => 'Terms and Conditions', 'documentSubtitle' => 'Jamjade Car Rental Agreement'])
    @if (isset($confirmation['agreementHtml']))
        {!! $confirmation['agreementHtml'] !!}
    @else
        @include('pdf.bookings.partials.terms-and-conditions')
    @endif
    @include('pdf.bookings.partials.renter-acknowledgement')
    <table class="page-footer"><tr>
        <td>Date issued: {{ $formatDate($confirmation['issuedAt'], 'F j, Y') }}</td>
        <td>Receipt: {{ $confirmation['receipt']['reference'] ?? 'Not provided' }}</td>
    </tr></table>
</div>
