@php
    $isRentalInformation = ($confirmation['formatVersion'] ?? 1) >= 3;
    $isConfirmed = strtolower((string) ($confirmation['bookingStatusLabel'] ?? '')) === 'confirmed';
    $rental = $confirmation['rental'] ?? [];
    $vehicle = $confirmation['vehicle'] ?? [];
    $formatDate = static fn ($value) => $value
        ? \Illuminate\Support\Carbon::parse($value)->timezone('Asia/Manila')->format('M j, Y, g:i A')
        : null;
    $rentalPeriod = trim(implode(' – ', array_filter([
        $formatDate($rental['startAt'] ?? null),
        $formatDate($rental['endAt'] ?? null),
    ])));
    $vehicleName = $vehicle['name'] ?? trim(implode(' ', array_filter([
        $vehicle['brand'] ?? null,
        $vehicle['model'] ?? null,
    ])));
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $isConfirmed ? 'Booking confirmed' : 'Payment received' }}</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #346EF6; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color: #17315F; overflow-wrap: anywhere; word-wrap: break-word;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width: 100%; max-width: 600px; border-collapse: separate; border-spacing: 0; background-color: #FFFFFF; border-radius: 14px; overflow: hidden;">
                    <tr>
                        <td style="padding: 26px 28px 8px; font-size: 18px; font-weight: 700; color: #346EF6;">JamJade Car Rental</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 28px 22px;">
                            <h1 style="margin: 0 0 14px; font-size: 24px; line-height: 1.25; color: #17315F;">{{ $isConfirmed ? 'Booking confirmed' : 'Payment received' }}</h1>
                            <p style="margin: 0;">Dear {{ $confirmation['customer']['name'] ?? 'Renter' }},</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 28px 18px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width: 100%; border-collapse: separate; border-spacing: 0; background-color: #F1F5FF; border-radius: 10px;">
                                <tr><td style="padding: 15px 18px 2px; color: #56709B; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;">Booking reference</td></tr>
                                <tr><td style="padding: 0 18px 15px; color: #17315F; font-size: 22px; font-weight: 700;">{{ $confirmation['bookingReference'] ?? '—' }}</td></tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 28px 18px;">
                            <p style="margin: 0 0 12px; font-size: 16px; font-weight: 700;">Booking details</p>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width: 100%; table-layout: fixed; border-collapse: collapse;">
                                @if ($vehicleName !== '')
                                <tr><td style="width: 38%; padding: 8px 6px 8px 0; border-bottom: 1px solid #DDE8FF; color: #56709B;">Vehicle</td><td align="right" style="width: 62%; padding: 8px 0; border-bottom: 1px solid #DDE8FF; color: #17315F; font-weight: 600; word-break: break-word; overflow-wrap: anywhere;">{{ $vehicleName }}</td></tr>
                                @endif
                                @if ($rentalPeriod !== '')
                                <tr><td style="padding: 8px 6px 8px 0; border-bottom: 1px solid #DDE8FF; color: #56709B;">Rental dates</td><td align="right" style="padding: 8px 0; border-bottom: 1px solid #DDE8FF; color: #17315F; font-weight: 600; word-break: break-word; overflow-wrap: anywhere;">{{ $rentalPeriod }}</td></tr>
                                @endif
                                @if (!empty($rental['pickupLocation']))
                                <tr><td style="padding: 8px 6px 8px 0; border-bottom: 1px solid #DDE8FF; color: #56709B;">Pickup</td><td align="right" style="padding: 8px 0; border-bottom: 1px solid #DDE8FF; color: #17315F; font-weight: 600; word-break: break-word; overflow-wrap: anywhere;">{{ $rental['pickupLocation'] }}</td></tr>
                                @endif
                                @if (!empty($rental['returnLocation']))
                                <tr><td style="padding: 8px 6px 8px 0; border-bottom: 1px solid #DDE8FF; color: #56709B;">Return</td><td align="right" style="padding: 8px 0; border-bottom: 1px solid #DDE8FF; color: #17315F; font-weight: 600; word-break: break-word; overflow-wrap: anywhere;">{{ $rental['returnLocation'] }}</td></tr>
                                @endif
                                <tr><td style="padding: 8px 6px 8px 0; border-bottom: 1px solid #DDE8FF; color: #56709B;">Booking status</td><td align="right" style="padding: 8px 0; border-bottom: 1px solid #DDE8FF; color: #17315F; font-weight: 600; word-break: break-word; overflow-wrap: anywhere;">{{ $confirmation['bookingStatusLabel'] ?? '—' }}</td></tr>
                                <tr><td style="padding: 8px 6px 8px 0; border-bottom: 1px solid #DDE8FF; color: #56709B;">Receipt reference</td><td align="right" style="padding: 8px 0; border-bottom: 1px solid #DDE8FF; color: #17315F; font-weight: 600; word-break: break-word; overflow-wrap: anywhere;">{{ $confirmation['receipt']['reference'] ?? '—' }}</td></tr>
                                @unless ($isRentalInformation)
                                <tr><td style="padding: 8px 6px 8px 0; border-bottom: 1px solid #DDE8FF; color: #56709B;">Invoice reference</td><td align="right" style="padding: 8px 0; border-bottom: 1px solid #DDE8FF; color: #17315F; font-weight: 600; word-break: break-word; overflow-wrap: anywhere;">{{ $confirmation['invoiceReference'] ?? '—' }}</td></tr>
                                @endunless
                                <tr><td style="padding: 8px 6px 8px 0; color: #56709B;">Payment status</td><td align="right" style="padding: 8px 0; color: #17315F; font-weight: 600; word-break: break-word; overflow-wrap: anywhere;">{{ $confirmation['paymentStatusLabel'] ?? '—' }}</td></tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 28px 22px;">
                            <p style="margin: 0 0 10px; font-size: 16px; font-weight: 700;">Payment summary at issue</p>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width: 100%; table-layout: fixed; border-collapse: collapse; background-color: #F8FAFF;">
                                <tr><td style="width: 58%; padding: 10px 8px; border-bottom: 1px solid #DDE8FF;">Amount received this payment</td><td align="right" style="width: 42%; padding: 10px 8px; border-bottom: 1px solid #DDE8FF; font-weight: 700; word-break: break-word;">PHP {{ number_format($confirmation['receipt']['amount'] ?? 0, 2) }}</td></tr>
                                <tr><td style="padding: 10px 8px; border-bottom: 1px solid #DDE8FF;">Total paid as of issue</td><td align="right" style="padding: 10px 8px; border-bottom: 1px solid #DDE8FF; font-weight: 700; word-break: break-word;">PHP {{ number_format($confirmation['payment']['amountPaid'] ?? 0, 2) }}</td></tr>
                                <tr><td style="padding: 10px 8px;">Remaining balance as of issue</td><td align="right" style="padding: 10px 8px; font-weight: 700; word-break: break-word;">PHP {{ number_format($confirmation['payment']['remainingBalance'] ?? 0, 2) }}</td></tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 28px 26px;">
                            <p style="margin: 0 0 14px;">Your {{ $isRentalInformation ? 'rental information' : 'invoice' }}, including the rental agreement, and payment receipt are attached. Please review and keep both PDFs for your records.</p>
                            <p style="margin: 0 0 14px;">Thank you for choosing JamJade Car Rental.</p>
                            <p style="margin: 0;">JamJade Car Rental</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
