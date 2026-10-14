<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Confirmation - {{ $confirmation['bookingReference'] }}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 18mm;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            color: #17315F;
            background: #FFFFFF;
            font-family: "DejaVu Sans", Arial, sans-serif;
            font-size: 8.5px;
            line-height: 1.32;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        .page {
            width: 100%;
        }

        .page-break {
            page-break-before: always;
        }

        .keep-together,
        .section,
        .acknowledgement {
            page-break-inside: avoid;
        }

        .header-table td {
            vertical-align: top;
        }

        .brand {
            width: 43%;
            vertical-align: middle;
        }

        .brand-lockup {
            width: auto;
        }

        .brand-logo-cell {
            width: 34px;
            padding-right: 8px;
            vertical-align: middle;
        }

        .brand-logo {
            display: block;
            width: 30px;
            height: 30px;
            object-fit: contain;
        }

        .brand-name-cell {
            vertical-align: middle;
        }

        .brand-name {
            color: #346EF6;
            font-size: 12.5px;
            font-weight: 700;
            letter-spacing: 0.45px;
            white-space: nowrap;
        }

        .document-heading {
            width: 57%;
            text-align: right;
        }

        .document-title {
            margin: 0;
            color: #17315F;
            font-size: 19px;
            font-weight: 700;
        }

        .document-subtitle {
            margin-top: 2px;
            color: #6C7A96;
            font-size: 9px;
        }

        .document-meta {
            margin-top: 8px;
            color: #6C7A96;
            font-size: 8.5px;
        }

        .document-meta strong {
            color: #17315F;
            font-weight: 700;
        }

        .accent-line {
            width: 38px;
            height: 3px;
            margin-top: 9px;
            background: #346EF6;
        }

        .header-divider {
            height: 1px;
            margin: 4px 0 8px;
            background: #E6EEFF;
        }

        .section {
            margin-top: 7px;
        }

        .section-heading {
            margin-bottom: 3px;
        }

        .section-title {
            margin: 0;
            color: #17315F;
            font-size: 9.5px;
            font-weight: 700;
            letter-spacing: 0.55px;
            text-transform: uppercase;
        }

        .section-title::before {
            display: inline-block;
            width: 3px;
            height: 9px;
            margin-right: 7px;
            background: #346EF6;
            content: "";
            vertical-align: -1px;
        }

        .section-subtitle {
            margin: 2px 0 0 10px;
            color: #6C7A96;
            font-size: 8.5px;
        }

        .info-grid {
            border-top: 1px solid #E6EEFF;
        }

        .info-grid td {
            width: 50%;
            padding: 3.5px 8px 3.5px 0;
            border-bottom: 1px solid #E6EEFF;
            vertical-align: top;
        }

        .info-grid td + td {
            padding-right: 0;
            padding-left: 14px;
            border-left: 1px solid #EEF3FF;
        }

        .info-grid-four td {
            width: 25%;
            padding-right: 7px;
            padding-left: 7px;
        }

        .info-grid-four td:first-child {
            padding-left: 0;
        }

        .info-grid-four td:last-child {
            padding-right: 0;
        }

        .label {
            display: block;
            margin-bottom: 2px;
            color: #6C7A96;
            font-size: 7.5px;
            font-weight: 700;
            letter-spacing: 0.45px;
            text-transform: uppercase;
        }

        .value {
            color: #17315F;
            font-size: 8.5px;
            font-weight: 600;
        }

        .status-badge {
            display: inline-block;
            padding: 0;
            border: 0;
            background: transparent;
            font-size: 8.5px;
            font-weight: 700;
            letter-spacing: 0.2px;
        }

        .status-success {
            color: #047857;
        }

        .status-warning {
            color: #C2410C;
        }

        .status-neutral {
            color: #6C7A96;
        }

        .payment-table {
            border-top: 1px solid #E6EEFF;
        }

        .payment-table td {
            padding: 1.5px 0;
            border-bottom: 1px solid #EEF3FF;
        }

        .payment-table .amount {
            width: 35%;
            color: #17315F;
            font-weight: 600;
            text-align: right;
        }

        .payment-table .total-row td {
            padding-top: 5px;
            padding-bottom: 5px;
            color: #17315F;
            font-size: 10.5px;
            font-weight: 700;
            border-top: 1px solid #C8D4E8;
        }

        .payment-table .paid-row .amount {
            color: #047857;
        }

        .payment-table .balance-row td {
            color: #346EF6;
            font-weight: 700;
        }

        .payment-meta {
            margin-top: 4px;
        }

        .terms-content {
            margin-top: 6px;
            padding: 6px 0 0 10px;
            border-top: 1px solid #E6EEFF;
            border-left: 3px solid #346EF6;
        }

        .terms-section {
            margin-bottom: 5px;
        }

        .terms-section:last-child {
            margin-bottom: 0;
        }

        .terms-section-title {
            margin: 0 0 3px;
            color: #17315F;
            font-size: 8.5px;
            font-weight: 700;
            letter-spacing: 0.3px;
            text-transform: uppercase;
        }

        .terms-list {
            margin: 0;
            padding-left: 16px;
        }

        .terms-list li {
            margin-bottom: 2px;
            padding-left: 2px;
            color: #17315F;
            font-size: 7.2px;
            line-height: 1.25;
        }

        .terms-list ul {
            margin: 1px 0;
            padding-left: 13px;
        }

        .terms-list ul li {
            margin-bottom: 0;
            color: #6C7A96;
            font-weight: 400;
        }

        .acknowledgement {
            margin-top: 9px;
            padding-top: 8px;
            border-top: 1px solid #C8D4E8;
        }

        .acknowledgement-title {
            margin: 0 0 6px;
            color: #17315F;
            font-size: 10.5px;
            font-weight: 700;
            letter-spacing: 0.6px;
        }

        .acknowledgement-copy {
            margin: 0 0 10px;
            color: #6C7A96;
            font-size: 8.5px;
            line-height: 1.42;
        }

        .signature-table td {
            width: 33.333%;
            padding-right: 14px;
            vertical-align: bottom;
        }

        .signature-table td:last-child {
            padding-right: 0;
        }

        .signature-value {
            min-height: 25px;
            padding-bottom: 3px;
            border-bottom: 1px solid #17315F;
            color: #17315F;
            font-size: 8.5px;
            text-align: center;
        }

        .signature-value img {
            display: block;
            width: 100%;
            max-width: 120px;
            height: 23px;
            margin: 0 auto;
        }

        .signature-label {
            margin-top: 4px;
            color: #6C7A96;
            font-size: 7px;
            letter-spacing: 0.35px;
            text-align: center;
            text-transform: uppercase;
        }

        .page-footer {
            margin-top: 7px;
            padding-top: 4px;
            border-top: 1px solid #EEF3FF;
            color: #91A0B8;
            font-size: 7px;
        }

        .page-footer td:last-child {
            text-align: right;
        }
    </style>
</head>
<body>
@php
    $displayValue = static fn ($value): string => filled($value) ? (string) $value : 'Not provided';
    $formatMoney = static fn ($value): string => 'PHP '.number_format((float) $value, 2);
    $formatDate = static fn ($value, string $format = 'F j, Y - g:i A'): string => $value?->format($format) ?? 'Not provided';
    $logoPath = public_path('images/JamJadeLogo-gradient.png');
    $logoDataUri = is_file($logoPath)
        ? 'data:image/png;base64,'.base64_encode(file_get_contents($logoPath))
        : null;
@endphp

<div class="page">
    @include('pdf.bookings.partials.header', [
        'documentTitle' => 'Booking Confirmation',
        'documentSubtitle' => 'Rental Confirmation',
    ])
    @include('pdf.bookings.partials.booking-summary')
    @include('pdf.bookings.partials.customer-info')
    @include('pdf.bookings.partials.vehicle-info')
    @include('pdf.bookings.partials.rental-details')
    @include('pdf.bookings.partials.payment-summary')

    <table class="page-footer">
        <tr>
            <td>Jamjade Car Rental · Booking confirmation</td>
            <td>Page 1 of 2</td>
        </tr>
    </table>
</div>

<div class="page page-break">
    @include('pdf.bookings.partials.header', [
        'documentTitle' => 'Terms and Conditions',
        'documentSubtitle' => 'Jamjade Car Rental Agreement',
    ])
    @include('pdf.bookings.partials.terms-and-conditions')
    @include('pdf.bookings.partials.renter-acknowledgement')

    <table class="page-footer">
        <tr>
            <td>Booking reference: {{ $confirmation['bookingReference'] }}</td>
            <td>Page 2 of 2</td>
        </tr>
    </table>
</div>
</body>
</html>
