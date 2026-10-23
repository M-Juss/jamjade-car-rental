@php($confirmation = $confirmation['invoiceSnapshot'] ?? $confirmation)
<div class="page">
    @include('pdf.bookings.partials.header', [
        'documentTitle' => 'Invoice',
    ])
    @include('pdf.bookings.partials.booking-summary')
    @include('pdf.bookings.partials.customer-info')
    @include('pdf.bookings.partials.vehicle-info')
    @include('pdf.bookings.partials.rental-details')
    @include('pdf.bookings.partials.payment-summary')

    <table class="page-footer">
        <tr>
            <td>Jamjade Car Rental · Invoice</td>
            <td></td>
        </tr>
    </table>
</div>

<div class="page page-break">
    @include('pdf.bookings.partials.header', [
        'documentTitle' => 'Terms and Conditions',
        'documentSubtitle' => 'Jamjade Car Rental Agreement',
    ])
    @if (isset($confirmation['agreementHtml']))
        {!! $confirmation['agreementHtml'] !!}
    @else
        @include('pdf.bookings.partials.terms-and-conditions')
    @endif
    @include('pdf.bookings.partials.renter-acknowledgement')

    <table class="page-footer">
        <tr>
            <td>Booking reference: {{ $confirmation['bookingReference'] }}</td>
            <td></td>
        </tr>
    </table>
</div>
